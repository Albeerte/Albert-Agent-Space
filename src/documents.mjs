import { inflateRawSync } from 'node:zlib';
import { fail } from './providers.mjs';

function docxBody(bytes) {
  if (bytes.length<22) throw fail('DOCX fayli ochilmadi.');
  let end=bytes.length-22;
  while (end>=0 && end>=bytes.length-65557 && bytes.readUInt32LE(end)!==0x06054b50) end--;
  if (end<0||end<bytes.length-65557) throw fail('DOCX fayli ochilmadi.');
  let cursor=bytes.readUInt32LE(end+16);
  const count=bytes.readUInt16LE(end+10);
  for(let i=0;i<count && cursor+46<=bytes.length;i++) {
    if(bytes.readUInt32LE(cursor)!==0x02014b50) break;
    const length=bytes.readUInt16LE(cursor+28);
    const name=bytes.toString('utf8',cursor+46,cursor+46+length);
    if(name==='word/document.xml') {
      const packed=bytes.readUInt32LE(cursor+20);
      const size=bytes.readUInt32LE(cursor+24);
      const offset=bytes.readUInt32LE(cursor+42);
      if(size>2000000 || offset+30>bytes.length) break;
      const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
      if (start+packed>bytes.length) break;
      const data=bytes.subarray(start,start+packed);
      const method=bytes.readUInt16LE(cursor+10);
      if (method!==0 && method!==8) break;
      const xml=(method===0 ? data : inflateRawSync(data,{maxOutputLength:2000000})).toString('utf8');
      return xml.replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<w:br\b[^>]*\/>|<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')
        .replace(/&(amp|lt|gt|quot|apos);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]);
    }
    cursor+=46+length+bytes.readUInt16LE(cursor+30)+bytes.readUInt16LE(cursor+32);
  }
  throw fail('DOCX faylidan matn topilmadi.');
}
export function extract(name,encoded) {
  if (typeof encoded!=='string' || encoded.length>2800000) throw fail('Fayl hajmi 2 MB dan oshmasligi kerak.',413);
  const bytes=Buffer.from(encoded,'base64');
  if (bytes.length>2000000) throw fail('Fayl hajmi 2 MB dan oshmasligi kerak.',413);
  const text=/\.docx$/i.test(name)?docxBody(bytes):
    /\.(txt|md|csv|json|log)$/i.test(name)?new TextDecoder('utf-8',{fatal:true}).decode(bytes):null;
  if (!text?.trim() || text.includes('\0')) throw fail('Matnli DOCX, TXT, MD, CSV, JSON yoki LOG fayl yuklang.');
  if (text.length>160000) throw fail('Hujjat matni 160 000 belgidan oshdi.',413);
  return text.trim();
}
export function contextFor(text,question) {
  if (text.length<=18000) return text;
  const terms=question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[];
  const chunks=text.match(/[\s\S]{1,2500}/g)??[];
  return chunks.map((chunk,index)=>{
    const lower=chunk.toLowerCase();
    return {chunk,index,score:terms.filter(term=>lower.includes(term)).length};
  }).sort((a,b)=>b.score-a.score).slice(0,7).sort((a,b)=>a.index-b.index).map(row=>row.chunk).join('\n[…]\n');
}
