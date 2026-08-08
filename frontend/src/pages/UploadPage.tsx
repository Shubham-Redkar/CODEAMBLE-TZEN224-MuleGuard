import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

type UploadResult = {
  statement_ids: number[];
  results: { filename: string; ood_score: number; ood_signals: Record<string, number>; status: string }[];
};

export function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.match(/\.(pdf|csv|xlsx|xls)$/i),
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.upload(files);
      setResult(res as UploadResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Upload Statements</h1>
      <p className="text-gray-500 mb-6">Upload PDF, CSV, or XLSX bank statements for analysis.</p>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
        />
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-1">Drag & drop files here</p>
        <p className="text-sm text-gray-400">or click to browse (PDF, CSV, XLSX)</p>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium mb-2">{files.length} file(s) selected</h3>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-white border rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <File className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{f.name}</span>
                  <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                </div>
                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {uploading ? "Uploading..." : "Upload & Analyze"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-700">Upload Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <h3 className="font-medium">Upload Results</h3>
          {result.results.map((r, i) => (
            <div key={i} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{r.filename}</span>
                <span className={`text-sm px-2 py-0.5 rounded ${
                  r.ood_score >= 0.7 ? "bg-green-100 text-green-700" : r.ood_score >= 0.4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                }`}>
                  OOD: {(r.ood_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
                {Object.entries(r.ood_signals || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    {v >= 0.5 ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="capitalize">{k.replace(/_/g, " ")}: {(v * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              {result.statement_ids[i] !== undefined && (
                <button
                  onClick={() => navigate(`/review/${result.statement_ids[i]}`)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Review Extraction
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
