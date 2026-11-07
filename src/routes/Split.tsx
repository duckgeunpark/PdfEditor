import { useState } from "react";
import Dropzone from "../components/Dropzone";
import {
  getPageCount,
  parsePageRanges,
  PasswordProtectedPdfError,
  splitByRanges,
  splitToIndividualPdfs,
} from "../lib/pdfEngine";
import { downloadAsZip, downloadPdfBytes } from "../lib/download";

type Mode = "each" | "ranges";

export default function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("each");
  const [rangeInput, setRangeInput] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    const pdf = files[0];
    if (!pdf) return;
    setLoadError(null);
    try {
      const count = await getPageCount(pdf);
      setFile(pdf);
      setPageCount(count);
    } catch (e) {
      console.error(e);
      setLoadError(
        e instanceof PasswordProtectedPdfError
          ? e.message
          : "PDF 파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.",
      );
    }
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setMode("each");
    setRangeInput("");
    setRangeError(null);
    setLoadError(null);
  };

  const runSplit = async () => {
    if (!file) return;
    setRangeError(null);

    let ranges: number[][];
    if (mode === "ranges") {
      try {
        ranges = parsePageRanges(rangeInput, pageCount);
      } catch (e) {
        setRangeError(e instanceof Error ? e.message : "범위를 확인해주세요.");
        return;
      }
    }

    setLoading(true);
    try {
      const entries =
        mode === "each"
          ? await splitToIndividualPdfs(file)
          : await splitByRanges(file, ranges!);

      if (entries.length === 1) {
        downloadPdfBytes(entries[0].bytes, entries[0].name);
      } else {
        const base = file.name.replace(/\.pdf$/i, "");
        await downloadAsZip(entries, `${base}_split.zip`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-center text-xl font-bold text-slate-900">
        PDF 분할
      </h1>

      {!file ? (
        <Dropzone
          accept="application/pdf"
          multiple={false}
          onFiles={handleFiles}
          label="PDF 파일을 여기로 드래그하거나 클릭해서 업로드"
          hint="예: 30페이지 PDF → 30개의 개별 PDF, 또는 원하는 범위로 분할"
        />
      ) : null}

      {!file && loadError && (
        <p className="mt-4 text-center text-sm text-red-500">{loadError}</p>
      )}

      {file && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <p className="font-medium text-slate-900">{file.name}</p>
            <p className="mt-1 text-sm text-slate-500">총 {pageCount}페이지</p>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setMode("each")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                mode === "each"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              페이지별로 분할
            </button>
            <button
              onClick={() => setMode("ranges")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                mode === "ranges"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              범위로 분할
            </button>
          </div>

          {mode === "each" ? (
            <p className="mt-4 text-center text-sm text-slate-500">
              {pageCount}개의 개별 PDF 파일로 분할됩니다.
            </p>
          ) : (
            <div className="mt-4">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                범위 (쉼표로 구분, 예: 1-4,7-10)
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => {
                    setRangeInput(e.target.value);
                    setRangeError(null);
                  }}
                  placeholder="1-4,7-10"
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <p className="mt-1 text-xs text-slate-400">
                예: "1-4,7-10"을 입력하면 1~4페이지와 7~10페이지, 총 2개의 PDF로 분할됩니다.
              </p>
              {rangeError && <p className="mt-1 text-xs text-red-500">{rangeError}</p>}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={reset}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              다른 파일 선택
            </button>
            <button
              onClick={runSplit}
              disabled={loading || (mode === "ranges" && rangeInput.trim() === "")}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {loading ? "분할 중..." : "분할하고 다운로드"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
