import { useEffect, useState } from "react";
import Dropzone from "../../components/Dropzone";
import { SortableGrid } from "../../components/SortableGrid";
import { imagesToPdf } from "../../lib/pdfEngine";
import { downloadPdfBytes } from "../../lib/download";
import type { UploadedFile } from "../../types";

function toUploadedFiles(files: File[]): UploadedFile[] {
  return files.map((f) => ({
    id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
    file: f,
    name: f.name,
  }));
}

interface ImageToPdfPanelProps {
  files: File[];
  onReset: () => void;
}

export default function ImageToPdfPanel({ files, onReset }: ImageToPdfPanelProps) {
  const [images, setImages] = useState<UploadedFile[]>(() => toUploadedFiles(files));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (newFiles: File[]) => {
    const items = newFiles.filter(
      (f) => /^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name),
    );
    setImages((prev) => [...prev, ...toUploadedFiles(items)]);
  };

  const removeImage = (id: string) =>
    setImages((prev) => prev.filter((f) => f.id !== id));

  const convert = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await imagesToPdf(images.map((i) => i.file));
      downloadPdfBytes(bytes, "images.pdf");
    } catch (e) {
      console.error(e);
      setError("PDF를 만드는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={onReset}
          className="text-sm font-medium text-slate-400 hover:text-slate-700"
        >
          처음으로
        </button>
      </div>

      <Dropzone
        accept="image/png,image/jpeg"
        multiple
        onFiles={addFiles}
        label="이미지들을 여기로 드래그하거나 클릭해서 업로드"
        hint="PNG, JPG 지원 · 여러 장 선택 가능"
      />

      {images.length > 0 && (
        <>
          <div className="mb-3 mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              드래그로 페이지 순서를 정하세요. 각 이미지가 한 페이지가 됩니다.
            </p>
            <button
              onClick={() => setImages([])}
              className="text-sm font-medium text-slate-400 hover:text-red-500"
            >
              전체 지우기
            </button>
          </div>
          <SortableGrid
            items={images}
            onReorder={setImages}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
            renderItem={(item, index) => (
              <ImageCard item={item} index={index} onRemove={() => removeImage(item.id)} />
            )}
          />

          <button
            onClick={convert}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {loading ? "변환 중..." : `${images.length}장으로 PDF 만들기`}
          </button>
        </>
      )}
      {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}

function ImageCard({
  item,
  index,
  onRemove,
}: {
  item: UploadedFile;
  index: number;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(item.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [item.file]);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
        {index + 1}
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 rounded bg-white/90 px-1.5 text-xs text-slate-500 opacity-0 hover:text-red-500 group-hover:opacity-100"
      >
        ✕
      </button>
      {url && (
        <img
          src={url}
          alt={item.name}
          draggable={false}
          className="h-40 w-full select-none bg-slate-50 object-contain"
        />
      )}
      <p className="truncate border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">
        {item.name}
      </p>
    </div>
  );
}
