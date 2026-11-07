import { useEffect, useState } from "react";
import { getPageCountPdfjs, convertPdfToImages } from "../../lib/pdfRender";
import { downloadBlob, downloadBlobsAsZip } from "../../lib/download";

const SCALE_OPTIONS = [
  { label: "표준 (1.5x)", value: 1.5 },
  { label: "고화질 (2.5x)", value: 2.5 },
  { label: "저용량 (1x)", value: 1 },
];

interface PdfToImagePanelProps {
  file: File;
  onReset: () => void;
}

export default function PdfToImagePanel({ file, onReset }: PdfToImagePanelProps) {
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPageCountPdfjs(file).then((count) => {
      if (!cancelled) setPageCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const convert = async () => {
    setLoading(true);
    setError(null);
    try {
      const images = await convertPdfToImages(file, format, scale);
      if (images.length === 1) {
        downloadBlob(images[0].blob, images[0].name);
      } else {
        const base = file.name.replace(/\.pdf$/i, "");
        await downloadBlobsAsZip(images, `${base}_images.zip`);
      }
    } catch (e) {
      console.error(e);
      setError("이미지로 변환하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="font-medium text-slate-900">{file.name}</p>
      <p className="mt-1 text-sm text-slate-500">총 {pageCount}페이지</p>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          형식
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            <option value="png">PNG (무손실)</option>
            <option value="jpeg">JPG (용량 작음)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          해상도
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            {SCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={onReset}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          다른 파일 선택
        </button>
        <button
          onClick={convert}
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {loading ? "변환 중..." : "이미지로 변환하기"}
        </button>
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
