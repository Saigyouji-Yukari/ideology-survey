"""Build the browser's immutable questionnaire bank from the approved OMNI sources."""
import json
import sys
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else repo / "data"
data = json.loads((source / "registry.json").read_text(encoding="utf-8"))
data["nearCardMap"] = json.loads((source / "near_card_map.json").read_text(encoding="utf-8"))
data["limits"] = {"minutes": 95, "maxModules": 2, "maxCards": 4, "maxResponses": 250}
data["provenance"] = {
    "questionnaire": "意识形态测试调查.docx",
    "scoring": "意识形态测试调查施测者计分说明.docx",
    "version": data["version"],
    "notice": "目录覆盖不等于单次全部核验；本版尚未进行真实样本效度校准。",
}
serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
content = "/* Generated from the approved OMNI questionnaire; do not edit by hand. */\n"
content += "(function(root){'use strict';const data=" + serialized + ";\n"
content += "if(typeof module==='object'&&module.exports)module.exports=data;else root.OMNI_DATA=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n"
(repo / "assets" / "omni-data.js").write_text(content, encoding="utf-8")
print(f"{len(data['cards'])} cards; {len(data['modules'])} modules; {len(data['core']['items'])} core items")
