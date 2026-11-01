"""Regenerate the browser-only reference data without changing its scoring code."""
import json
import re
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
config = json.loads((repo / 'data/tendency_profiles.json').read_text(encoding='utf-8'))
people = json.loads((repo / 'data/tendency_people.json').read_text(encoding='utf-8'))
serialized = json.dumps(config, ensure_ascii=False, separators=(',', ':'))
module = repo / 'assets/omni-profile.js'
source = module.read_text(encoding='utf-8')
pattern = r'/\* PROFILE_DATA_START \*/[\s\S]*?/\* PROFILE_DATA_END \*/'
source, count = re.subn(pattern, lambda _: '/* PROFILE_DATA_START */ ' + serialized + ' /* PROFILE_DATA_END */', source)
if count != 1:
    raise SystemExit('Expected one browser profile data marker; no files changed.')
module.write_text(source, encoding='utf-8', newline='\n')
body = json.dumps(people, ensure_ascii=False, separators=(',', ':'))
content = "/* Historical examples and licensed portraits; source: data/tendency_people.json. */\n"
content += "(function(root){'use strict';const people=" + body + ";\n"
content += "if(typeof module==='object'&&module.exports)module.exports=people;else root.OMNI_PEOPLE=people;\n})(typeof globalThis!=='undefined'?globalThis:this);\n"
(repo / 'assets/omni-people.js').write_text(content, encoding='utf-8', newline='\n')
print(f"{len(config['profiles'])} reference types; {len(people)} people; browser data synchronized")
