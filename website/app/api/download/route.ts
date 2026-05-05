// GET /api/download?path=xxx — 通用文件下载端点

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
  }

  // 安全检查：只允许访问项目根目录下的文件
  const projectRoot = process.cwd();
  const allowedDir = projectRoot;
  const resolvedPath = path.resolve(allowedDir, filePath);

  // 防止路径遍历攻击
  if (!resolvedPath.startsWith(allowedDir)) {
    return NextResponse.json({ error: "Access denied: invalid path" }, { status: 403 });
  }

  // 检查文件是否存在
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // 读取文件内容
  const fileBuffer = fs.readFileSync(resolvedPath);
  const fileName = path.basename(resolvedPath);
  const ext = path.extname(fileName).toLowerCase();

  // 根据文件类型设置 Content-Type
  const contentTypes: Record<string, string> = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".json": "application/json",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".tsx": "text/tsx",
    ".jsx": "text/jsx",
    ".css": "text/css",
    ".html": "text/html",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };

  const contentType = contentTypes[ext] || "application/octet-stream";

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": fileBuffer.length.toString(),
    },
  });
}