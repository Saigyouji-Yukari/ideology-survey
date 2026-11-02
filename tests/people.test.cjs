'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const people=require('../assets/omni-people.js'),source=require('../data/tendency_people.json'),config=require('../data/tendency_profiles.json');
const root=path.resolve(__dirname,'..');
test('every reference type has several sourced representative figures and every person is used',()=>{
 assert.deepEqual(people,source);
 const used=new Set();
 for(const profile of config.profiles){
  assert(Array.isArray(profile.figures)&&profile.figures.length>=2,profile.id+' needs at least two representatives');
  assert.equal(new Set(profile.figures.map(f=>f.personId)).size,profile.figures.length,profile.id+' repeats a person');
  for(const figure of profile.figures){assert(people[figure.personId],profile.id+' missing '+figure.personId);assert(figure.focus&&figure.focus.length<=30,figure.personId+' focus');used.add(figure.personId);}
 }
 assert.deepEqual([...used].sort(),Object.keys(people).sort(),'no unused or missing people');
 assert(Object.keys(people).length>32,'reference figures are not limited to the original 32 types');
});
test('every person has dates, an introduction and https sources; portraits are local, genuine and licensed',()=>{
 let portraits=0;
 for(const [id,person] of Object.entries(people)){
  assert.equal(person.id,id);assert(/^[a-z0-9-]+$/.test(id));
  assert(person.name&&person.years&&person.description,id);assert(person.description.includes('此处'),id+' states what the figure illustrates');
  assert(person.sources.length>0,id);for(const s of person.sources){assert(s.title,id);assert.equal(new URL(s.url).protocol,'https:');}
  if(person.portrait){
   portraits++;
   assert(/^assets\/portraits\/[a-z0-9_-]+\.jpg$/.test(person.portrait));
   const bytes=fs.readFileSync(path.join(root,person.portrait));assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert(bytes.length>1000);
   const credit=person.imageCredit;assert(credit.creator&&credit.title&&credit.changes);
   assert(/公有领域|Public domain|CC BY(?:-SA)? [234]\.[05]|CC0/.test(credit.licenseName),id+' supported free license');
   assert.equal(new URL(credit.sourceUrl).hostname,'commons.wikimedia.org');assert.equal(new URL(credit.licenseUrl).protocol,'https:');
   assert.equal(new URL(credit.licenseUrl).hostname,'creativecommons.org');
   const sources=fs.readFileSync(path.join(root,'PORTRAIT_SOURCES.md'),'utf8');
   for(const value of [person.name,person.portrait,credit.title,credit.creator,credit.sourceUrl,credit.licenseUrl])assert(sources.includes(value),id+' attribution is documented: '+value);
  }else{
   // People without a licensed local portrait get a one-character name tile, never a remote or generated image.
   assert.equal(person.imageCredit,undefined,id);
   assert(/^[㐀-鿿]$/.test(person.monogram)&&person.name.includes(person.monogram),id+' monogram');
  }
 }
 assert.equal(portraits,92,'all 65 newly verified portraits are included');
 assert.deepEqual(Object.values(people).filter(p=>!p.portrait).map(p=>p.id).sort(),['cole','postman','schumacher','tawney']);
 assert.deepEqual(fs.readdirSync(path.join(root,'assets/portraits')).sort(),Object.values(people).filter(p=>p.portrait).map(p=>path.basename(p.portrait)).sort());
});
test('browser reference data matches CommonJS rules and people exactly',()=>{
 const context={};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/omni-profile.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/omni-people.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_PROFILE.config)),config);
 assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_PEOPLE)),people);
});
