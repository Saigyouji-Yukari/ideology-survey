'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const people=require('../assets/omni-people.js'),source=require('../data/tendency_people.json'),config=require('../data/tendency_profiles.json');
const root=path.resolve(__dirname,'..');
test('every reference type has a sourced person and a genuine local JPEG portrait',()=>{
 assert.deepEqual(people,source);
 for(const profile of config.profiles)assert(people[profile.personId],profile.id+' missing representative');
 for(const person of Object.values(people)){
  assert(person.name&&person.years&&person.description);assert(person.sources.length>0);
  assert(/^assets\/portraits\/[a-z0-9_-]+\.jpg$/.test(person.portrait));
  const bytes=fs.readFileSync(path.join(root,person.portrait));assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert(bytes.length>1000);
  for(const s of person.sources)assert.equal(new URL(s.url).protocol,'https:');
  const credit=person.imageCredit;assert(credit.creator&&credit.title&&credit.changes);assert(/公有领域|Public domain/.test(credit.licenseName));assert.equal(new URL(credit.sourceUrl).hostname,'commons.wikimedia.org');assert.equal(new URL(credit.licenseUrl).protocol,'https:');
 }
});
test('browser reference data matches CommonJS rules and people exactly',()=>{
 const context={};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/omni-profile.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/omni-people.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_PROFILE.config)),config);
 assert.deepEqual(JSON.parse(JSON.stringify(context.OMNI_PEOPLE)),people);
});
