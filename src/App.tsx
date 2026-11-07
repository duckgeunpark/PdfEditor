import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Home from "./routes/Home";
import PageEditor from "./routes/PageEditor";
import Split from "./routes/Split";
import FileConvert from "./routes/convert/FileConvert";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/edit" element={<PageEditor />} />
        <Route path="/split" element={<Split />} />
        <Route path="/convert" element={<FileConvert />} />
        {/* Old standalone tools now live inside /edit and /convert. */}
        <Route path="/merge" element={<Navigate to="/edit" replace />} />
        <Route path="/to-image" element={<Navigate to="/convert" replace />} />
        <Route path="/from-image" element={<Navigate to="/convert" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
