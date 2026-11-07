import { useState, type ReactNode } from "react";
import Dropzone from "../../components/Dropzone";
import PdfToImagePanel from "./PdfToImagePanel";
import ImageToPdfPanel from "./ImageToPdfPanel";

type ConverterId = "pdf-to-image" | "image-to-pdf";

interface ConverterDef {
  id: ConverterId;
  detect: (files: File[]) => boolean;
  render: (files: File[], onReset: () => void) => ReactNode;
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) =>
  /^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name);

// Which conversion to run is chosen from the uploaded file(s)' type, not a
// menu choice. detect and render travel together on each entry so adding a
// new source format later (with its own panel component) can't accidentally
// fall through to the wrong panel.
const CONVERTERS: ConverterDef[] = [
  {
    id: "pdf-to-image",
    detect: (files) => files.length === 1 && isPdf(files[0]),
    render: (files, onReset) => <PdfToImagePanel file={files[0]} onReset={onReset} />,
  },
  {
    id: "image-to-pdf",
    detect: (files) => files.length > 0 && files.every(isImage),
    render: (files, onReset) => <ImageToPdfPanel files={files} onReset={onReset} />,
  },
];

export default function FileConvert() {
  const [converterId, setConverterId] = useState<ConverterId | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (incoming: File[]) => {
    const converter = CONVERTERS.find((c) => c.detect(incoming));
    if (!converter) {
      setError("지원하지 않는 파일 형식입니다. PDF 1개 또는 이미지 파일들을 올려주세요.");
      return;
    }
    setError(null);
    setConverterId(converter.id);
    setFiles(incoming);
  };

  const reset = () => {
    setConverterId(null);
    setFiles([]);
    setError(null);
  };

  const activeConverter = CONVERTERS.find((c) => c.id === converterId);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-center text-xl font-bold text-slate-900">파일 변환</h1>

      {!activeConverter ? (
        <>
          <Dropzone
            accept="application/pdf,.pdf,image/png,image/jpeg"
            multiple
            onFiles={handleFiles}
            label="PDF 또는 이미지 파일을 여기로 드래그하거나 클릭해서 업로드"
            hint="PDF 1개를 올리면 이미지로, 이미지를 올리면 PDF로 변환합니다"
          />
          {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}
        </>
      ) : (
        <div key={activeConverter.id}>{activeConverter.render(files, reset)}</div>
      )}
    </div>
  );
}
