import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-slate-900">PDF Cutter</span>
        </Link>
        {!isHome && (
          <Link
            to="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← 도구 선택으로
          </Link>
        )}
      </div>
      <div className="bg-slate-900 py-1.5 text-center text-xs text-slate-300">
        모든 파일은 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.
      </div>
    </header>
  );
}
