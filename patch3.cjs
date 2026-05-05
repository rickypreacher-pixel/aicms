const fs = require('fs');
const fp = String.raw`C:\Users\Admin\OneDrive\Desktop\ntcc-church-app-2026\src\App.tsx`;
let src = fs.readFileSync(fp, 'utf8');
const orig = src;

const old = `                          {isSel&&(
                            <div style={{borderTop:"0.5px solid "+BR,padding:"10px 12px"}}>
                              <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Check-In</div>
                              {newVis&&<FamilyForm newVis={newVis} setNewVis={setNewVis} onSubmit={doCIFam} allPeople={allPeople}/>}
                              {!newVis&&(<div style={{marginBottom:8}}>
                                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type name to search..." style={{width:"100%",padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:4}}/>
                                {search.trim().length>1&&results.length===0&&<div style={{fontSize:11,color:MU,padding:"4px 2px"}}>No match. <button onClick={()=>setNewVis(initV())} style={{background:"none",border:"none",color:N,cursor:"pointer",fontSize:11,fontWeight:500,padding:0}}>Add as new visitor</button></div>}
                                {results.map(p=>{const inn=checkedIds.has(p.id);return(<div key={p.id} onClick={()=>!inn&&doCI(p)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:7,border:"0.5px solid "+(inn?GR+"55":BR),background:inn?"#f0fdf4":W,cursor:inn?"default":"pointer",marginBottom:4}}><Av f={p.first} l={p.last} sz={24}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.first} {p.last}</div><div style={{fontSize:10,color:MU}}>{p.ptype==="member"?"Member":p.stage||"Visitor"}</div></div>{inn?<span style={{fontSize:10,color:GR,fontWeight:600}}>In</span>:<span style={{fontSize:10,background:N,color:"#fff",borderRadius:4,padding:"2px 6px"}}>Check In</span>}</div>);})}
                              </div>)}
                              {!newVis&&!search&&<button onClick={()=>setNewVis(initV())} style={{width:"100%",padding:"6px",background:BG,border:"0.5px dashed "+G,borderRadius:7,fontSize:11,cursor:"pointer",color:MU,marginBottom:8}}>+ New Visitor or Family</button>}
                              {eci.length>0&&(<div style={{borderTop:"0.5px solid "+BR,paddingTop:8,marginTop:4}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4,marginBottom:5,fontWeight:500}}>Checked In — {eci.length}</div>{eci.map(ci=><div key={ci.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",background:"#f0fdf4",borderRadius:6,border:"0.5px solid #86efac",marginBottom:4}}><Av f={ci.first} l={ci.last} sz={20}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ci.first} {ci.last}</div><div style={{fontSize:9,color:MU}}>{ci.isNew?(ci.role||"New"):ci.ptype==="member"?"Member":"Visitor"}{ci.family?" · "+ci.family:""}</div></div><span style={{fontSize:9,color:GR,fontWeight:600}}>done</span></div>)}</div>)}
                            </div>
                          )}`;

const newBlock = `                          {isSel&&(
                            <div style={{borderTop:"0.5px solid "+BR}}>
                              {PLANNER_SERVICES.includes(evt.name)&&(
                                <div style={{display:"flex",borderBottom:"0.5px solid "+BR,background:BG,flexShrink:0}}>
                                  {(["checkin","planner"]).map((t)=>(
                                    <button key={t} onClick={()=>setEvtDetailTab(t)} style={{flex:1,padding:"8px 4px",border:"none",borderBottom:"2px solid "+(evtDetailTab===t?evt.color:"transparent"),background:"transparent",color:evtDetailTab===t?evt.color:MU,fontSize:11,fontWeight:evtDetailTab===t?600:400,cursor:"pointer",transition:"all 0.15s"}}>
                                      {t==="checkin"?"Check In":"Schedule Planner"}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {evtDetailTab!=="planner"&&(
                                <div style={{padding:"10px 12px"}}>
                                  <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Check-In</div>
                                  {newVis&&<FamilyForm newVis={newVis} setNewVis={setNewVis} onSubmit={doCIFam} allPeople={allPeople}/>}
                                  {!newVis&&(<div style={{marginBottom:8}}>
                                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type name to search..." style={{width:"100%",padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:4}}/>
                                    {search.trim().length>1&&results.length===0&&<div style={{fontSize:11,color:MU,padding:"4px 2px"}}>No match. <button onClick={()=>setNewVis(initV())} style={{background:"none",border:"none",color:N,cursor:"pointer",fontSize:11,fontWeight:500,padding:0}}>Add as new visitor</button></div>}
                                    {results.map(p=>{const inn=checkedIds.has(p.id);return(<div key={p.id} onClick={()=>!inn&&doCI(p)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:7,border:"0.5px solid "+(inn?GR+"55":BR),background:inn?"#f0fdf4":W,cursor:inn?"default":"pointer",marginBottom:4}}><Av f={p.first} l={p.last} sz={24}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.first} {p.last}</div><div style={{fontSize:10,color:MU}}>{p.ptype==="member"?"Member":p.stage||"Visitor"}</div></div>{inn?<span style={{fontSize:10,color:GR,fontWeight:600}}>In</span>:<span style={{fontSize:10,background:N,color:"#fff",borderRadius:4,padding:"2px 6px"}}>Check In</span>}</div>);})}
                                  </div>)}
                                  {!newVis&&!search&&<button onClick={()=>setNewVis(initV())} style={{width:"100%",padding:"6px",background:BG,border:"0.5px dashed "+G,borderRadius:7,fontSize:11,cursor:"pointer",color:MU,marginBottom:8}}>+ New Visitor or Family</button>}
                                  {eci.length>0&&(<div style={{borderTop:"0.5px solid "+BR,paddingTop:8,marginTop:4}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4,marginBottom:5,fontWeight:500}}>Checked In — {eci.length}</div>{eci.map(ci=><div key={ci.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",background:"#f0fdf4",borderRadius:6,border:"0.5px solid #86efac",marginBottom:4}}><Av f={ci.first} l={ci.last} sz={20}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ci.first} {ci.last}</div><div style={{fontSize:9,color:MU}}>{ci.isNew?(ci.role||"New"):ci.ptype==="member"?"Member":"Visitor"}{ci.family?" · "+ci.family:""}</div></div><span style={{fontSize:9,color:GR,fontWeight:600}}>done</span></div>)}</div>)}
                                </div>
                              )}
                              {evtDetailTab==="planner"&&PLANNER_SERVICES.includes(evt.name)&&(
                                <div style={{padding:"10px 12px",overflowY:"auto",maxHeight:480}}>
                                  <div style={{marginBottom:12}}>
                                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                                      <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5}}>Songs / Worship</div>
                                      <button onClick={addSong} style={{fontSize:10,padding:"2px 8px",border:"0.5px solid "+N,borderRadius:5,background:"transparent",color:N,cursor:"pointer"}}>+ Add Song</button>
                                    </div>
                                    {plan.songs.map((s,si)=>(
                                      <div key={si} style={{background:BG,border:"0.5px solid "+BR,borderRadius:7,padding:"8px 9px",marginBottom:6}}>
                                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                                          <div style={{fontSize:10,color:MU,fontWeight:500}}>Song {si+1}</div>
                                          {plan.songs.length>1&&<button onClick={()=>remSong(si)} style={{fontSize:10,background:"transparent",border:"none",color:RE,cursor:"pointer",padding:0}}>Remove</button>}
                                        </div>
                                        <div style={{marginBottom:5}}>
                                          <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Title</div>
                                          <input value={s.title} onChange={e=>setSong(si,"title",e.target.value)} placeholder="Song title..." style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                        </div>
                                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                                          <div>
                                            <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Key</div>
                                            <input value={s.key} onChange={e=>setSong(si,"key",e.target.value)} placeholder="e.g. A, Bb, C#" style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                          </div>
                                          <div>
                                            <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Leader</div>
                                            <input value={s.leader} onChange={e=>setSong(si,"leader",e.target.value)} placeholder="Worship leader..." style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{marginBottom:12}}>
                                    <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Sermon / Bible Study</div>
                                    <div style={{background:BG,border:"0.5px solid "+BR,borderRadius:7,padding:"8px 9px"}}>
                                      <div style={{marginBottom:6}}>
                                        <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Title / Topic</div>
                                        <input value={plan.sermonTitle} onChange={e=>setSermon("sermonTitle",e.target.value)} placeholder="Sermon title..." style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                      </div>
                                      <div style={{marginBottom:6}}>
                                        <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Scripture Reference</div>
                                        <input value={plan.sermonScripture} onChange={e=>setSermon("sermonScripture",e.target.value)} placeholder="e.g. John 3:16, Romans 8:28" style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                      </div>
                                      <div>
                                        <div style={{fontSize:9,color:MU,marginBottom:2,textTransform:"uppercase",letterSpacing:0.3}}>Speaker</div>
                                        <input value={plan.sermonSpeaker} onChange={e=>setSermon("sermonSpeaker",e.target.value)} placeholder="Speaker / Pastor name..." style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{marginBottom:12}}>
                                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                                      <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5}}>Announcements</div>
                                      <button onClick={addAnn} style={{fontSize:10,padding:"2px 8px",border:"0.5px solid "+N,borderRadius:5,background:"transparent",color:N,cursor:"pointer"}}>+ Add</button>
                                    </div>
                                    {plan.announcements.map((a,ai)=>(
                                      <div key={ai} style={{display:"flex",gap:6,marginBottom:5,alignItems:"center"}}>
                                        <div style={{fontSize:11,color:MU,minWidth:16,textAlign:"right"}}>{ai+1}.</div>
                                        <input value={a} onChange={e=>setAnn(ai,e.target.value)} placeholder={"Announcement "+(ai+1)+"..."} style={{flex:1,padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none"}}/>
                                        {plan.announcements.length>1&&<button onClick={()=>remAnn(ai)} style={{fontSize:14,background:"transparent",border:"none",color:RE,cursor:"pointer",padding:"0 2px",lineHeight:1}}>x</button>}
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={()=>{
                                    const w=window.open("","_blank","width=720,height=900");
                                    if(!w)return;
                                    const dateStr=new Date(evt.date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
                                    const songsRows=plan.songs.map((s,i)=>'<tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6">'+(i+1)+'</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6">'+(s.title||'&mdash;')+'</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6">'+(s.key||'&mdash;')+'</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6">'+(s.leader||'&mdash;')+'</td></tr>').join('');
                                    const annRows=plan.announcements.map((a,i)=>'<div style="margin-bottom:8px;padding-left:4px"><span style="color:#999;margin-right:8px">'+(i+1)+'.</span>'+(a||'&mdash;')+'</div>').join('');
                                    w.document.write('<!DOCTYPE html><html><head><title>'+evt.name+' Plan</title><style>body{font-family:Georgia,serif;max-width:640px;margin:40px auto;color:#1f2937;font-size:14px}h1{font-size:22px;margin-bottom:4px;color:#1e3a5f}h2{font-size:13px;color:#6b7280;margin:0 0 24px;font-weight:normal}h3{font-size:12px;color:#1e3a5f;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin-top:22px;text-transform:uppercase;letter-spacing:0.5px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;padding:5px 10px;border-bottom:1px solid #e5e7eb}@media print{body{margin:20px}}</style></head><body><h1>'+evt.name+'</h1><h2>'+dateStr+(evt.time?' &middot; '+evt.time:'')+'</h2><h3>Songs / Worship</h3><table><thead><tr><th>#</th><th>Title</th><th>Key</th><th>Leader</th></tr></thead><tbody>'+songsRows+'</tbody></table><h3>Sermon / Bible Study</h3><p><strong>Title:</strong> '+(plan.sermonTitle||'&mdash;')+'</p><p><strong>Scripture:</strong> '+(plan.sermonScripture||'&mdash;')+'</p><p><strong>Speaker:</strong> '+(plan.sermonSpeaker||'&mdash;')+'</p><h3>Announcements</h3>'+annRows+'</body></html>');
                                    w.document.close();w.print();
                                  }} style={{width:"100%",padding:"8px",background:N,color:"#fff",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:500}}>Print / Export Plan</button>
                                </div>
                              )}
                            </div>
                          )}`;

if (src.includes(old)) {
  src = src.replace(old, newBlock);
  console.log('C3 OK');
} else {
  // Try CRLF variant
  const oldCrlf = old.replace(/\n/g, '\r\n');
  if (src.includes(oldCrlf)) {
    src = src.replace(oldCrlf, newBlock);
    console.log('C3 OK (CRLF)');
  } else {
    const idx = src.indexOf('                          {isSel&&(');
    console.log('C3 NOT FOUND. isSel position:', idx);
    if (idx >= 0) console.log('Context:', JSON.stringify(src.substring(idx, idx+300)));
    process.exit(1);
  }
}

fs.writeFileSync(fp, src, 'utf8');
console.log('Saved');
