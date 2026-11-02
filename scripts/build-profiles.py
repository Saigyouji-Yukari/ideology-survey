"""Regenerate the browser-only reference data and the tables in PROFILE_RULES.md without changing scoring code."""
import json
import re
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
config = json.loads((repo / 'data/tendency_profiles.json').read_text(encoding='utf-8'))
people = json.loads((repo / 'data/tendency_people.json').read_text(encoding='utf-8'))


def replace_block(text, start, end, body, name):
    pattern = re.escape(start) + r'[\s\S]*?' + re.escape(end)
    result, count = re.subn(pattern, lambda _: start + '\n' + body + '\n' + end, text)
    if count != 1:
        raise SystemExit(f'Expected one {name} marker pair; no files changed.')
    return result


# Every figure must name a known person, and every person must be used, so the
# published catalogue never carries people that the report cannot show.
used = {f['personId'] for p in config['profiles'] for f in p['figures']}
if used - set(people) or set(people) - used:
    raise SystemExit(f'People and figures disagree: missing {sorted(used - set(people))}, unused {sorted(set(people) - used)}')

serialized = json.dumps(config, ensure_ascii=False, separators=(',', ':'))
module = repo / 'assets/omni-profile.js'
source = module.read_text(encoding='utf-8')
source, count = re.subn(r'/\* PROFILE_DATA_START \*/[\s\S]*?/\* PROFILE_DATA_END \*/', lambda _: '/* PROFILE_DATA_START */ ' + serialized + ' /* PROFILE_DATA_END */', source)
if count != 1:
    raise SystemExit('Expected one browser profile data marker; no files changed.')

body = json.dumps(people, ensure_ascii=False, separators=(',', ':'))
people_js = "/* Historical examples, some with licensed portraits; source: data/tendency_people.json. */\n"
people_js += "(function(root){'use strict';const people=" + body + ";\n"
people_js += "if(typeof module==='object'&&module.exports)module.exports=people;else root.OMNI_PEOPLE=people;\n})(typeof globalThis!=='undefined'?globalThis:this);\n"


def number(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def vector(values):
    return '；'.join(f'{k} {number(v)}' for k, v in values.items())


def anchors(rules):
    parts = []
    for k, rule in rules.items():
        if 'min' in rule and 'max' in rule:
            parts.append(f"{number(rule['min'])} ≤ {k} ≤ {number(rule['max'])}")
        elif 'min' in rule:
            parts.append(f"{k} ≥{number(rule['min'])}")
        else:
            parts.append(f"{k} ≤{number(rule['max'])}")
    return '；'.join(parts) or '无'


type_rows = ['| 栏目 | 参考型 | 代表人物（首位为默认） | 参考向量 | 必要方向条件 |', '| --- | --- | --- | --- | --- |']
figure_rows = ['| 参考型 | 代表人物 | 生卒 | 侧重 | 人物参照点（只列与中心不同的分面） |', '| --- | --- | --- | --- | --- |']
for p in config['profiles']:
    names = '、'.join(people[f['personId']]['name'] for f in p['figures'])
    type_rows.append(f"| {p['section']} | {p['label']} | {names} | {vector(p['targets'])} | {anchors(p['anchors'])} |")
    for f in p['figures']:
        person = people[f['personId']]
        point = vector(f['targets']) if f['targets'] else '与参考型中心相同'
        figure_rows.append(f"| {p['label']} | {person['name']} | {person['years']} | {f['focus']} | {point} |")

rules_path = repo / 'PROFILE_RULES.md'
rules = rules_path.read_text(encoding='utf-8')
rules = replace_block(rules, '<!-- PROFILE_TABLE_START -->', '<!-- PROFILE_TABLE_END -->', '\n'.join(type_rows), 'reference type table')
rules = replace_block(rules, '<!-- FIGURE_TABLE_START -->', '<!-- FIGURE_TABLE_END -->', '\n'.join(figure_rows), 'figure table')

module.write_text(source, encoding='utf-8', newline='\n')
(repo / 'assets/omni-people.js').write_text(people_js, encoding='utf-8', newline='\n')
rules_path.write_text(rules, encoding='utf-8', newline='\n')
portraits = sum(1 for person in people.values() if person.get('portrait'))
print(f"{len(config['profiles'])} reference types; {sum(len(p['figures']) for p in config['profiles'])} figure entries; {len(people)} people ({portraits} with portraits); browser data and rule tables synchronized")
