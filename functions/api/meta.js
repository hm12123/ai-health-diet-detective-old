// 화면에 들어갈 글을 _config.js 에서 그대로 내보냅니다.
// 덕분에 고칠 파일이 _config.js 하나로 유지됩니다.
import { 화면 } from "../_config.js";

export function onRequestGet() {
  return Response.json(화면);
}
