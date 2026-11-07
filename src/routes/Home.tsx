import ToolCard from "../components/ToolCard";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          원하는 편집 기능을 선택하세요
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          업로드한 PDF는 브라우저 밖으로 나가지 않습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          to="/edit"
          title="페이지 편집"
          description="여러 PDF를 이어붙이고, 페이지 삭제·추출·순서변경·회전·자르기(범위/픽셀)"
          icon={<span className="text-lg">📄</span>}
        />
        <ToolCard
          to="/split"
          title="PDF 분할"
          description="페이지별로 낱장 분할하거나, 1-4,7-10처럼 원하는 범위로 나누어 분할"
          icon={<span className="text-lg">✂️</span>}
        />
        <ToolCard
          to="/convert"
          title="파일 변환"
          description="PDF ↔ 이미지 변환 · 올린 파일 형식에 따라 자동으로 변환 방식을 선택합니다"
          icon={<span className="text-lg">🔄</span>}
        />
      </div>
    </div>
  );
}
