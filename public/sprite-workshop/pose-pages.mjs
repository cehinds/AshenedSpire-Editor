export function posePage(poses,query='',page=0,size=24){
  const q=query.toLowerCase(),rows=Object.values(poses).filter(p=>[p.id,p.name,p.classId,p.outfit,p.weapon,p.offhandType].join(' ').toLowerCase().includes(q));
  const pages=Math.max(1,Math.ceil(rows.length/size)),index=Math.max(0,Math.min(pages-1,page));
  return {rows:rows.slice(index*size,(index+1)*size),page:index,pages,total:rows.length};
}
