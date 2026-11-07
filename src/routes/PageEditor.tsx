import { useRef, useState } from "react";
import Dropzone from "../components/Dropzone";
import PageThumbnail from "../components/PageThumbnail";
import CropModal from "../components/CropModal";
import DrawModal from "../components/DrawModal";
import PagePreviewPanel from "../components/PagePreviewPanel";
import { SortableGrid } from "../components/SortableGrid";
import { renderAllThumbnails, renderCroppedThumbnail, renderPageThumbnail } from "../lib/pdfRender";
import { buildEditedPdfFromSources, type MultiSourcePageEditSpec } from "../lib/pdfEngine";
import { downloadPdfBytes } from "../lib/download";
import type { CropBox, DrawObject, PageState } from "../types";

interface LoadedSource {
  id: string;
  file: File;
}

export default function PageEditor() {
  const [sources, setSources] = useState<LoadedSource[]>([]);
  const [pages, setPages] = useState<PageState[]>([]);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [drawTargetId, setDrawTargetId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      setError("PDF 파일만 추가할 수 있습니다.");
      return;
    }
    setLoading(true);

    const newSources: LoadedSource[] = [];
    const newPages: PageState[] = [];
    const failedNames: string[] = [];

    for (const pdf of pdfs) {
      try {
        const sourceId = `${pdf.name}-${pdf.size}-${Date.now()}-${Math.random()}`;
        const rendered = await renderAllThumbnails(pdf);
        newSources.push({ id: sourceId, file: pdf });
        rendered.forEach((r, i) => {
          newPages.push({
            id: `${sourceId}-page-${i}`,
            sourceFile: pdf,
            originalIndex: i,
            rotation: 0,
            intrinsicRotation: r.intrinsicRotation,
            selected: false,
            cropBox: null,
            drawings: [],
            width: r.width,
            height: r.height,
            thumbnail: r.thumbnail,
          });
        });
      } catch (e) {
        console.error(e);
        failedNames.push(pdf.name);
      }
    }

    if (newSources.length > 0) {
      setSources((prev) => [...prev, ...newSources]);
      setPages((prev) => [...prev, ...newPages]);
    }

    if (failedNames.length > 0) {
      setError(
        `다음 파일을 여는 중 오류가 발생했습니다: ${failedNames.join(", ")}`,
      );
    } else if (pdfs.length < files.length) {
      setError("PDF가 아닌 파일은 제외하고 추가했습니다.");
    } else {
      setError(null);
    }

    setLoading(false);
  };

  const handleAddFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  // Lets a file be dropped anywhere on the loaded editor view, not just via
  // the "다른 파일 추가" button, so adding more PDFs works the same way as
  // the initial empty-state Dropzone.
  const handleEditorDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleEditorDragLeave = () => setIsDragging(false);

  const handleEditorDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files));
  };

  const removeSource = (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    setPages((prev) => prev.filter((p) => p.sourceFile !== source.file));
  };

  const toggleSelect = (id: string) =>
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    );

  const rotatePage = (id: string) =>
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, rotation: ((p.rotation + 90) % 360) as PageState["rotation"] }
          : p,
      ),
    );

  const removePage = (id: string) =>
    setPages((prev) => prev.filter((p) => p.id !== id));

  const removeSelected = () =>
    setPages((prev) => prev.filter((p) => !p.selected));

  const selectedCount = pages.filter((p) => p.selected).length;

  const specsFor = (list: PageState[]): MultiSourcePageEditSpec[] =>
    list.map((p) => ({
      file: p.sourceFile,
      originalIndex: p.originalIndex,
      rotationDelta: p.rotation,
      cropBox: p.cropBox,
      drawings: p.drawings,
    }));

  const outputBaseName = (list: PageState[]) => {
    const uniqueSourceFiles = new Set(list.map((p) => p.sourceFile));
    return uniqueSourceFiles.size === 1 ? baseName(list[0].sourceFile.name) : "merged";
  };

  const extractSelected = async () => {
    const selected = pages.filter((p) => p.selected);
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await buildEditedPdfFromSources(specsFor(selected));
      downloadPdfBytes(bytes, `${outputBaseName(selected)}_extracted.pdf`);
    } catch (e) {
      console.error(e);
      setError("PDF를 만드는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = async () => {
    if (pages.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await buildEditedPdfFromSources(specsFor(pages));
      downloadPdfBytes(bytes, `${outputBaseName(pages)}_edited.pdf`);
    } catch (e) {
      console.error(e);
      setError("PDF를 만드는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const applyCrop = async (box: CropBox, applyToAll: boolean) => {
    const target = pages.find((p) => p.id === cropTargetId);
    setCropTargetId(null);
    if (!target) return;

    // box is in the target page's own raw MediaBox space, so "apply to all"
    // only makes sense for pages that share that exact size/rotation —
    // stamping it onto a differently-sized merged page would crop out of
    // bounds. Pages that don't match keep their own crop unchanged.
    const matchesTarget = (p: PageState) =>
      p.width === target.width &&
      p.height === target.height &&
      p.intrinsicRotation === target.intrinsicRotation;
    const eligible = (p: PageState) =>
      p.id === target.id || (applyToAll && matchesTarget(p));

    const skippedCount = applyToAll
      ? pages.filter((p) => p.id !== target.id && !matchesTarget(p)).length
      : 0;

    setPages((prev) => prev.map((p) => (eligible(p) ? { ...p, cropBox: box } : p)));
    if (skippedCount > 0) {
      setError(`크기가 다른 페이지 ${skippedCount}개는 자르기가 적용되지 않았습니다.`);
    }

    // Re-render the affected thumbnail(s) so the grid/detail preview shows
    // the cropped region instead of always showing the full original page.
    const affected = pages.filter(eligible);
    const updates = await Promise.all(
      affected.map(async (p) => {
        const thumbnail = await renderCroppedThumbnail(
          p.sourceFile,
          p.originalIndex,
          { box, rawWidth: p.width, rawHeight: p.height },
          p.intrinsicRotation,
        );
        return { id: p.id, thumbnail };
      }),
    );
    setPages((prev) =>
      prev.map((p) => {
        const update = updates.find((u) => u.id === p.id);
        return update ? { ...p, thumbnail: update.thumbnail } : p;
      }),
    );
  };

  const removeCrop = async (id: string) => {
    const target = pages.find((p) => p.id === id);
    if (!target || !target.cropBox) return;
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, cropBox: null } : p)));
    const thumbnail = await renderPageThumbnail(
      target.sourceFile,
      target.originalIndex,
      target.width,
      target.height,
      target.intrinsicRotation,
    );
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, thumbnail } : p)));
  };

  const applyDrawing = (drawings: DrawObject[]) => {
    const targetId = drawTargetId;
    setDrawTargetId(null);
    if (!targetId) return;
    setPages((prev) => prev.map((p) => (p.id === targetId ? { ...p, drawings } : p)));
  };

  const removeDrawings = (id: string) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, drawings: [] } : p)));

  const cropTarget = pages.find((p) => p.id === cropTargetId) ?? null;
  const drawTarget = pages.find((p) => p.id === drawTargetId) ?? null;
  const previewIndex = pages.findIndex((p) => p.id === previewId);
  const previewTarget = previewIndex === -1 ? null : pages[previewIndex];

  if (sources.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-center text-xl font-bold text-slate-900">
          페이지 편집
        </h1>
        <Dropzone
          accept="application/pdf,.pdf"
          multiple
          onFiles={handleFiles}
          label="PDF 파일을 여기로 드래그하거나 클릭해서 업로드"
          hint="여러 PDF를 함께 선택하면 순서대로 하나로 합쳐집니다"
        />
        {loading && <p className="mt-4 text-center text-sm text-slate-500">불러오는 중...</p>}
        {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full max-w-6xl flex-1 px-4 py-8 transition-colors ${
        isDragging ? "bg-slate-100 outline-dashed outline-2 outline-offset-[-8px] outline-slate-400" : ""
      }`}
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={handleEditorDrop}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">페이지 편집</h1>
          <p className="text-sm text-slate-500">
            총 {pages.length}페이지 · 드래그로 순서 변경 · 썸네일 클릭 시 미리보기 · 체크박스로 선택 · 카드 안 버튼으로 회전/자르기 · 화면에 파일을 끌어다 놓아도 추가됩니다
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => addFileInputRef.current?.click()}
            disabled={loading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            + 다른 파일 추가
          </button>
          <input
            ref={addFileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={handleAddFileInputChange}
          />
          <button
            onClick={removeSelected}
            disabled={selectedCount === 0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            선택 삭제 ({selectedCount})
          </button>
          <button
            onClick={extractSelected}
            disabled={selectedCount === 0 || loading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            선택만 추출
          </button>
          <button
            onClick={downloadAll}
            disabled={pages.length === 0 || loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {loading ? "처리 중..." : "전체 다운로드"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {sources.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1.5 text-xs text-slate-600"
          >
            <span className="max-w-[240px] truncate" title={s.file.name}>
              {s.file.name}
            </span>
            <button
              type="button"
              onClick={() => removeSource(s.id)}
              className="rounded-full px-1 text-slate-400 hover:text-red-500"
              title="이 파일 제거"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {pages.length === 0 ? (
            <p className="text-center text-sm text-slate-400">모든 페이지가 삭제되었습니다.</p>
          ) : (
            <SortableGrid
              items={pages}
              onReorder={setPages}
              className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]"
              renderItem={(page, index) => (
                <PageThumbnail
                  page={page}
                  index={index}
                  isPreviewing={page.id === previewId}
                  onToggleSelect={() => toggleSelect(page.id)}
                  onRotate={() => rotatePage(page.id)}
                  onCrop={() => setCropTargetId(page.id)}
                  onRemoveCrop={() => removeCrop(page.id)}
                  onDraw={() => setDrawTargetId(page.id)}
                  onRemoveDrawings={() => removeDrawings(page.id)}
                  onRemove={() => removePage(page.id)}
                  onPreview={() => setPreviewId(page.id)}
                />
              )}
            />
          )}
        </div>

        {previewTarget && (
          <PagePreviewPanel
            file={previewTarget.sourceFile}
            pageIndex={previewTarget.originalIndex}
            pageWidth={previewTarget.width}
            pageHeight={previewTarget.height}
            intrinsicRotation={previewTarget.intrinsicRotation}
            cropBox={previewTarget.cropBox}
            drawings={previewTarget.drawings}
            fallbackSrc={previewTarget.thumbnail}
            rotation={previewTarget.rotation}
            pageNumber={previewIndex + 1}
            onClose={() => setPreviewId(null)}
          />
        )}
      </div>

      {cropTarget && (
        <CropModal
          file={cropTarget.sourceFile}
          pageIndex={cropTarget.originalIndex}
          pageWidth={cropTarget.width}
          pageHeight={cropTarget.height}
          intrinsicRotation={cropTarget.intrinsicRotation}
          initialCrop={cropTarget.cropBox}
          onApply={applyCrop}
          onClose={() => setCropTargetId(null)}
        />
      )}

      {drawTarget && (
        <DrawModal
          file={drawTarget.sourceFile}
          pageIndex={drawTarget.originalIndex}
          pageWidth={drawTarget.width}
          pageHeight={drawTarget.height}
          intrinsicRotation={drawTarget.intrinsicRotation}
          initialDrawings={drawTarget.drawings}
          onApply={applyDrawing}
          onClose={() => setDrawTargetId(null)}
        />
      )}
    </div>
  );
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "");
}
