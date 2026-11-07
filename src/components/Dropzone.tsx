import { useCallback, useRef, useState, type DragEvent } from "react";

interface DropzoneProps {
  accept: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint: string;
}

export default function Dropzone({
  accept,
  multiple,
  onFiles,
  label,
  hint,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
        isDragging
          ? "border-slate-900 bg-slate-100"
          : "border-slate-300 bg-white hover:border-slate-400"
      }`}
    >
      <p className="text-base font-medium text-slate-800">{label}</p>
      <p className="text-sm text-slate-400">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
