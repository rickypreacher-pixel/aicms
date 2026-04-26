// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

// ── MAINTENANCE & EQUIPMENT ──
const MAINT_CATS=["Audio","Video","HVAC","Vehicles","Electrical","Plumbing","Kitchen","Office","Musical Instruments","Grounds/Landscaping","Other"];
const MCAT_COLORS={"Audio":"#7c3aed","Video":"#2563eb","HVAC":"#0891b2","Vehicles":"#ea580c","Electrical":"#d97706","Plumbing":"#0e7490","Kitchen":"#dc2626","Office":"#6b7280","Musical Instruments":"#c9a84c","Grounds/Landscaping":"#16a34a","Other":"#6b7280"};
const MAINT_LOCS=["Sanctuary","Fellowship Hall","Office","Education Wing","Kitchen","Nursery","Parking Lot","Church Vehicle","Outside","Other"];
const WO_PRIORITIES=["Low","Medium","High","Urgent"];
const PRI_COLORS={"Low":"#16a34a","Medium":"#d97706","High":"#ea580c","Urgent":"#dc2626"};
const WO_STATUSES=["Open","In Progress","On Hold","Completed"];
const WO_STATUS_COLORS={"Open":"#2563eb","In Progress":"#d97706","On Hold":"#6b7280","Completed":"#16a34a"};
const MAINT_FREQS=["Weekly","Bi-Weekly","Monthly","Quarterly","Semi-Annually","Yearly"];
const FREQ_DAYS={"Weekly":7,"Bi-Weekly":14,"Monthly":30,"Quarterly":90,"Semi-Annually":180,"Yearly":365};

const ISEED_EQUIP:any[]=[];
const ISEED_SCHED:any[]=[];
const ISEED_WO:any[]=[];

function maintStatus(sched){
  const today=td();
  if(!sched.nextService||!sched.active) return null;
  if(sched.nextService<today) return {label:"Overdue",color:RE,bg:"#fee2e2",days:daysBetween(sched.nextService,today)};
  if(sched.nextService===today) return {label:"Due Today",color:RE,bg:"#fee2e2",days:0};
  const d=daysBetween(today,sched.nextService);
  if(d<=3) return {label:"Urgent",color:"#ea580c",bg:"#ffedd5",days:d};
  if(d<=7) return {label:"Upcoming",color:AM,bg:"#fef9c3",days:d};
  return {label:"On Track",color:GR,bg:"#dcfce7",days:d};
}
function warrantyStatus(eq){
  if(!eq.warrantyExpires) return {label:"No Warranty",color:MU,bg:BG};
  const today=td();
  if(eq.warrantyExpires<today) return {label:"Expired",color:RE,bg:"#fee2e2"};
  const d=daysBetween(today,eq.warrantyExpires);
  if(d<=30) return {label:"Expiring Soon",color:AM,bg:"#fef9c3",days:d};
  return {label:"Active",color:GR,bg:"#dcfce7",days:d};
}
function computeNextService(last,freq){return last?addDays(last,FREQ_DAYS[freq]||30):null;}
function computeMaintAlerts(equipment,schedMaint){
  const today=td();
  const active=schedMaint.filter(s=>s.active);
  const overdue=active.filter(s=>s.nextService&&s.nextService<today);
  const urgent=active.filter(s=>{if(!s.nextService||s.nextService<today)return false;const d=daysBetween(today,s.nextService);return d>=0&&d<=3;});
  const upcoming=active.filter(s=>{if(!s.nextService||s.nextService<today)return false;const d=daysBetween(today,s.nextService);return d>3&&d<=7;});
  const warrantyExpired=equipment.filter(e=>e.warrantyExpires&&e.warrantyExpires<today&&e.status==="Active");
  const warrantyExpiringSoon=equipment.filter(e=>{if(!e.warrantyExpires||e.warrantyExpires<today||e.status!=="Active")return false;return daysBetween(today,e.warrantyExpires)<=30;});
  return {overdue,urgent,upcoming,warrantyExpired,warrantyExpiringSoon};
}

function AssigneePicker({value,onChange,users,members}){
  const mode=value?.type||"free";
  const setMode=m=>onChange({type:m,userId:null,memberId:null,name:""});
  const slStyle={width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"};
  return (<div>
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      {[["user","Staff User"],["member","Church Member"],["free","Vendor / Other"]].map(([m,lbl])=><button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"6px 10px",borderRadius:7,border:"0.5px solid "+(mode===m?N:BR),background:mode===m?N:W,color:mode===m?"#fff":TX,fontSize:12,cursor:"pointer",fontWeight:mode===m?500:400}}>{lbl}</button>)}
    </div>
    {mode==="user" && <select value={value?.userId||""} onChange={e=>{const id=+e.target.value||null;const u=users.find(x=>x.id===id);const m=u&&members.find(x=>x.id===u.memberId);onChange({type:"user",userId:id,memberId:null,name:m?m.first+" "+m.last:""});}} style={slStyle}>
      <option value="">Select a user</option>
      {users.filter(u=>u.status==="Active").map(u=>{const m=members.find(x=>x.id===u.memberId);return m?<option key={u.id} value={u.id}>{m.first} {m.last}</option>:null;})}
    </select>}
    {mode==="member" && <select value={value?.memberId||""} onChange={e=>{const id=+e.target.value||null;const m=members.find(x=>x.id===id);onChange({type:"member",userId:null,memberId:id,name:m?m.first+" "+m.last:""});}} style={slStyle}>
      <option value="">Select a member</option>
      {members.map(m=><option key={m.id} value={m.id}>{m.first} {m.last}{m.role?" ("+m.role+")":""}</option>)}
    </select>}
    {mode==="free" && <Inp value={value?.name||""} onChange={v=>onChange({type:"free",userId:null,memberId:null,name:v})} placeholder="e.g. Cooper Climate Control, outside vendor..."/>}
  </div>);
}

function MaintAlertBanner({alerts}){
  const total=alerts.overdue.length+alerts.urgent.length+alerts.warrantyExpired.length+alerts.warrantyExpiringSoon.length;
  if(total===0) return null;
  return (<div style={{background:"#fef2f2",border:"1.5px solid "+RE+"44",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:32,height:32,borderRadius:"50%",background:RE+"18",color:RE,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>!</div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:RE}}>Maintenance Alerts ({total})</div>
        <div style={{fontSize:11,color:"#7f1d1d",marginTop:2}}>
          {alerts.overdue.length>0 && alerts.overdue.length+" overdue · "}
          {alerts.urgent.length>0 && alerts.urgent.length+" urgent · "}
          {alerts.upcoming.length>0 && alerts.upcoming.length+" upcoming · "}
          {alerts.warrantyExpired.length>0 && alerts.warrantyExpired.length+" expired warranty · "}
          {alerts.warrantyExpiringSoon.length>0 && alerts.warrantyExpiringSoon.length+" warranty expiring soon"}
        </div>
      </div>
    </div>
  </div>);
}

function MaintDashboard({equipment,workOrders,schedMaint,alerts,setTab}){
  const openWOs=workOrders.filter(w=>w.status!=="Completed");
  const recentWOs=[...workOrders].sort((a,b)=>b.createdDate.localeCompare(a.createdDate)).slice(0,5);
  const totalEquipValue=equipment.reduce((a,e)=>a+(+e.cost||0),0);
  return (<div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <Stat label="Active Equipment" value={equipment.filter(e=>e.status==="Active").length} color={BL} sub={"$"+totalEquipValue.toLocaleString()+" total value"}/>
      <Stat label="Open Work Orders" value={openWOs.length} color={AM} sub={workOrders.filter(w=>w.priority==="Urgent"&&w.status!=="Completed").length+" urgent"}/>
      <Stat label="Scheduled Tasks" value={schedMaint.filter(s=>s.active).length} color={N}/>
      <Stat label="Overdue" value={alerts.overdue.length} color={RE} sub="Need attention"/>
      <Stat label="Warranty Alerts" value={alerts.warrantyExpired.length+alerts.warrantyExpiringSoon.length} color={AM} sub={alerts.warrantyExpired.length+" expired · "+alerts.warrantyExpiringSoon.length+" soon"}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Maintenance Due Soon</h3>
          <Btn onClick={()=>setTab("scheduled")} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>View All</Btn>
        </div>
        {alerts.overdue.length===0&&alerts.urgent.length===0&&alerts.upcoming.length===0 ? <div style={{padding:24,textAlign:"center",color:MU,fontSize:13}}>All maintenance on track</div> : (<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto"}}>{[...alerts.overdue,...alerts.urgent,...alerts.upcoming].slice(0,8).map(s=>{const eq=equipment.find(e=>e.id===s.equipmentId);const st=maintStatus(s);return (<div key={s.id} style={{padding:"9px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR,borderLeft:"3px solid "+st.color}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,gap:8}}><span style={{fontSize:13,fontWeight:500,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",flex:1}}>{eq?eq.name:"Unknown"}</span><span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:10,padding:"1px 7px",fontWeight:500,flexShrink:0}}>{st.label}{st.label==="Overdue"?" "+st.days+"d":st.days?" in "+st.days+"d":""}</span></div><div style={{fontSize:11,color:MU}}>{s.taskName} · Due {fd(s.nextService)}</div></div>);})}</div>)}
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Recent Work Orders</h3>
          <Btn onClick={()=>setTab("workorders")} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>View All</Btn>
        </div>
        {recentWOs.length===0 ? <div style={{padding:24,textAlign:"center",color:MU,fontSize:13}}>No work orders yet</div> : (<div style={{display:"flex",flexDirection:"column",gap:8}}>{recentWOs.map(wo=>(<div key={wo.id} style={{padding:"9px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,gap:8}}><span style={{fontSize:13,fontWeight:500,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",flex:1}}>{wo.title}</span><span style={{fontSize:10,background:PRI_COLORS[wo.priority]+"22",color:PRI_COLORS[wo.priority],borderRadius:10,padding:"1px 7px",fontWeight:500,flexShrink:0}}>{wo.priority}</span></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:MU}}>{wo.assignedName||"Unassigned"} · {fd(wo.createdDate)}</span><span style={{fontSize:10,background:WO_STATUS_COLORS[wo.status]+"22",color:WO_STATUS_COLORS[wo.status],borderRadius:10,padding:"1px 7px",fontWeight:500}}>{wo.status}</span></div></div>))}</div>)}
      </div>
    </div>
    {(alerts.warrantyExpired.length>0||alerts.warrantyExpiringSoon.length>0) && (<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Warranty Alerts</h3>
        <Btn onClick={()=>setTab("equipment")} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>View Equipment</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
        {[...alerts.warrantyExpired,...alerts.warrantyExpiringSoon].map(eq=>{const ws=warrantyStatus(eq);return (<div key={eq.id} style={{padding:"10px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR,borderLeft:"3px solid "+ws.color}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,gap:6}}><span style={{fontSize:13,fontWeight:500,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{eq.name}</span><span style={{fontSize:10,background:ws.bg,color:ws.color,borderRadius:10,padding:"1px 7px",fontWeight:500,flexShrink:0}}>{ws.label}</span></div><div style={{fontSize:11,color:MU}}>{eq.category} · {eq.location} · Expires {fd(eq.warrantyExpires)}</div></div>);})}
      </div>
    </div>)}
  </div>);
}

function EquipmentTab({equipment,setEquipment,workOrders,schedMaint,canEdit}){
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("all");
  const [filterLoc,setFilterLoc]=useState("all");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [detail,setDetail]=useState(null);
  const [form,setForm]=useState({name:"",category:"Other",location:"Other",serial:"",purchaseDate:"",warrantyExpires:"",vendor:"",manufacturer:"",cost:"",status:"Active",notes:""});
  const nid=useRef(4000);
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const filtered=equipment.filter(e=>{if(search&&!(e.name+" "+(e.serial||"")+" "+(e.manufacturer||"")).toLowerCase().includes(search.toLowerCase())) return false;if(filterCat!=="all"&&e.category!==filterCat) return false;if(filterLoc!=="all"&&e.location!==filterLoc) return false;return true;});
  const openAdd=()=>{if(!canEdit){alert("Permission required.");return;}setEditing(null);setForm({name:"",category:"Other",location:"Other",serial:"",purchaseDate:"",warrantyExpires:"",vendor:"",manufacturer:"",cost:"",status:"Active",notes:""});setModal(true);};
  const openEdit=e=>{if(!canEdit){alert("Permission required.");return;}setEditing(e);setForm({...e,cost:String(e.cost||"")});setModal(true);};
  const save=()=>{if(!form.name){alert("Name required.");return;}const data={...form,cost:+form.cost||0};if(editing) setEquipment(es=>es.map(e=>e.id===editing.id?{...e,...data}:e));else setEquipment(es=>[...es,{...data,id:nid.current++}]);setModal(false);};
  const del=id=>{if(!canEdit){alert("Permission required.");return;}if(confirm("Delete this equipment?")) setEquipment(es=>es.filter(e=>e.id!==id));};
  return (<div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, serial, manufacturer..." style={{flex:1,minWidth:200,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
      <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}><option value="all">All Categories</option>{MAINT_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}><option value="all">All Locations</option>{MAINT_LOCS.map(l=><option key={l} value={l}>{l}</option>)}</select>
      <Btn onClick={openAdd} v="primary" disabled={!canEdit}>+ Add Equipment</Btn>
    </div>
    <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
      {filtered.length===0 ? <div style={{padding:40,textAlign:"center",color:MU}}>No equipment found.</div> : (<table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"#f8f9fc"}}>{["Equipment","Category","Location","Serial","Warranty","Status",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(e=>{const ws=warrantyStatus(e);const activeWOs=workOrders.filter(w=>w.equipmentId===e.id&&w.status!=="Completed").length;return (<tr key={e.id} onClick={()=>setDetail(e)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={evt=>evt.currentTarget.style.background="#f8f9fc"} onMouseLeave={evt=>evt.currentTarget.style.background=W}>
          <td style={{padding:"10px 14px"}}><div style={{fontSize:13,fontWeight:500,color:N}}>{e.name}</div><div style={{fontSize:11,color:MU}}>{e.manufacturer||""}{e.cost?" · $"+Number(e.cost).toLocaleString():""}{activeWOs>0?" · "+activeWOs+" open WO":""}</div></td>
          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:MCAT_COLORS[e.category]+"18",color:MCAT_COLORS[e.category],borderRadius:20,padding:"2px 9px",fontWeight:500}}>{e.category}</span></td>
          <td style={{padding:"10px 14px",fontSize:12}}>{e.location}</td>
          <td style={{padding:"10px 14px",fontSize:11,color:MU,fontFamily:"monospace"}}>{e.serial||"—"}</td>
          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:ws.bg,color:ws.color,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{ws.label}</span></td>
          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,color:e.status==="Active"?GR:MU,background:e.status==="Active"?"#dcfce7":"#f5f5f5",borderRadius:20,padding:"2px 9px",fontWeight:500}}>{e.status}</span></td>
          <td style={{padding:"10px 14px"}} onClick={evt=>evt.stopPropagation()}><div style={{display:"flex",gap:5}}><Btn onClick={()=>openEdit(e)} v="ghost" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>Edit</Btn><Btn onClick={()=>del(e.id)} v="danger" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>X</Btn></div></td>
        </tr>);})}</tbody>
      </table>)}
    </div>
    <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Equipment":"Add New Equipment"}>
      <Fld label="Equipment Name *"><Inp value={form.name} onChange={sf("name")} placeholder="e.g. Yamaha TF5 Mixer"/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Category"><Slt value={form.category} onChange={sf("category")} opts={MAINT_CATS}/></Fld><Fld label="Location"><Slt value={form.location} onChange={sf("location")} opts={MAINT_LOCS}/></Fld></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Serial / Asset ID"><Inp value={form.serial} onChange={sf("serial")}/></Fld><Fld label="Cost ($)"><Inp type="number" value={form.cost} onChange={sf("cost")}/></Fld></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Manufacturer"><Inp value={form.manufacturer} onChange={sf("manufacturer")}/></Fld><Fld label="Vendor"><Inp value={form.vendor} onChange={sf("vendor")}/></Fld></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Purchase Date"><Inp type="date" value={form.purchaseDate} onChange={sf("purchaseDate")}/></Fld><Fld label="Warranty Expires"><Inp type="date" value={form.warrantyExpires} onChange={sf("warrantyExpires")}/></Fld></div>
      <Fld label="Status"><Slt value={form.status} onChange={sf("status")} opts={["Active","Retired","Out of Service"]}/></Fld>
      <Fld label="Notes"><Inp value={form.notes} onChange={sf("notes")}/></Fld>
      <div style={{display:"flex",gap:8}}><Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save</Btn><Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
    </Modal>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title="" width={560}>
      {detail && (()=>{const ws=warrantyStatus(detail);const related=schedMaint.filter(s=>s.equipmentId===detail.id);const history=workOrders.filter(w=>w.equipmentId===detail.id);return (<div style={{marginTop:-14}}>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0 16px",borderBottom:"0.5px solid "+BR,marginBottom:14}}>
          <div style={{width:48,height:48,borderRadius:10,background:MCAT_COLORS[detail.category]+"14",color:MCAT_COLORS[detail.category],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0}}>{detail.category.slice(0,3).toUpperCase()}</div>
          <div style={{flex:1}}><div style={{fontSize:18,fontWeight:500,color:N}}>{detail.name}</div><div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}><span style={{fontSize:11,background:MCAT_COLORS[detail.category]+"18",color:MCAT_COLORS[detail.category],borderRadius:20,padding:"2px 9px",fontWeight:500}}>{detail.category}</span><span style={{fontSize:11,background:BG,color:TX,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{detail.location}</span><span style={{fontSize:11,background:ws.bg,color:ws.color,borderRadius:20,padding:"2px 9px",fontWeight:500}}>Warranty: {ws.label}</span></div></div>
          <Btn onClick={()=>{setDetail(null);openEdit(detail);}} v="outline" style={{fontSize:12}} disabled={!canEdit}>Edit</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>{[["Serial",detail.serial],["Cost",detail.cost?"$"+Number(detail.cost).toLocaleString():""],["Manufacturer",detail.manufacturer],["Vendor",detail.vendor],["Purchased",fd(detail.purchaseDate)],["Warranty Expires",fd(detail.warrantyExpires)]].map(([k,v])=>v?<div key={k} style={{background:BG,borderRadius:8,padding:"8px 12px",border:"0.5px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>{k}</div><div style={{fontSize:13,fontWeight:500,marginTop:2}}>{v}</div></div>:null)}</div>
        {detail.notes && <div style={{background:GL+"44",border:"0.5px solid "+G,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#7a5c10"}}><strong>Notes:</strong> {detail.notes}</div>}
        {related.length>0 && <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:500,color:N,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Scheduled Maintenance ({related.length})</div>{related.map(s=>{const st=maintStatus(s);return (<div key={s.id} style={{padding:"7px 11px",background:BG,borderRadius:7,border:"0.5px solid "+BR,marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,fontWeight:500}}>{s.taskName}</div><div style={{fontSize:10,color:MU}}>{s.frequency} · Next {fd(s.nextService)}</div></div>{st&&<span style={{fontSize:10,background:st.bg,color:st.color,borderRadius:10,padding:"1px 7px",fontWeight:500}}>{st.label}</span>}</div>);})}</div>}
        {history.length>0 && <div><div style={{fontSize:12,fontWeight:500,color:N,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Work Order History ({history.length})</div>{history.slice(0,5).map(wo=>(<div key={wo.id} style={{padding:"7px 11px",background:BG,borderRadius:7,border:"0.5px solid "+BR,marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,fontWeight:500}}>{wo.title}</div><div style={{fontSize:10,color:MU}}>{fd(wo.createdDate)} · {wo.assignedName||"Unassigned"}</div></div><span style={{fontSize:10,background:WO_STATUS_COLORS[wo.status]+"22",color:WO_STATUS_COLORS[wo.status],borderRadius:10,padding:"1px 7px",fontWeight:500}}>{wo.status}</span></div>))}</div>}
      </div>);})()}
    </Modal>
  </div>);
}

function WorkOrdersTab({workOrders,setWorkOrders,equipment,users,members,canEdit}){
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterPriority,setFilterPriority]=useState("all");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [detail,setDetail]=useState(null);
  const [updateNote,setUpdateNote]=useState("");
  const [form,setForm]=useState({title:"",description:"",equipmentId:null,priority:"Medium",status:"Open",assignedType:"free",assignedUserId:null,assignedMemberId:null,assignedName:"",createdDate:td(),completedDate:null,updates:[]});
  const nid=useRef(5000);
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const filtered=workOrders.filter(w=>{if(search&&!(w.title+" "+(w.description||"")+" "+(w.assignedName||"")).toLowerCase().includes(search.toLowerCase())) return false;if(filterStatus!=="all"&&w.status!==filterStatus) return false;if(filterPriority!=="all"&&w.priority!==filterPriority) return false;return true;});
  const openAdd=()=>{if(!canEdit){alert("Permission required.");return;}setEditing(null);setForm({title:"",description:"",equipmentId:null,priority:"Medium",status:"Open",assignedType:"free",assignedUserId:null,assignedMemberId:null,assignedName:"",createdDate:td(),completedDate:null,updates:[]});setModal(true);};
  const openEdit=wo=>{if(!canEdit){alert("Permission required.");return;}setEditing(wo);setForm({...wo,equipmentId:wo.equipmentId||null});setModal(true);};
  const save=()=>{if(!form.title){alert("Title required.");return;}const data={...form,completedDate:form.status==="Completed"&&!form.completedDate?td():form.status!=="Completed"?null:form.completedDate};if(editing) setWorkOrders(ws=>ws.map(w=>w.id===editing.id?{...w,...data}:w));else setWorkOrders(ws=>[...ws,{...data,id:nid.current++}]);setModal(false);};
  const del=id=>{if(!canEdit){alert("Permission required.");return;}if(confirm("Delete this work order?")) setWorkOrders(ws=>ws.filter(w=>w.id!==id));};
  const addUpdate=()=>{if(!updateNote.trim()||!detail) return;const updated={...detail,updates:[...(detail.updates||[]),{date:td(),note:updateNote.trim()}]};setWorkOrders(ws=>ws.map(w=>w.id===detail.id?updated:w));setDetail(updated);setUpdateNote("");};
  const changeStatus=(wo,newStatus)=>{const updated={...wo,status:newStatus,completedDate:newStatus==="Completed"&&!wo.completedDate?td():newStatus!=="Completed"?null:wo.completedDate};setWorkOrders(ws=>ws.map(w=>w.id===wo.id?updated:w));if(detail?.id===wo.id) setDetail(updated);};
  const stats={open:workOrders.filter(w=>w.status==="Open").length,inProgress:workOrders.filter(w=>w.status==="In Progress").length,onHold:workOrders.filter(w=>w.status==="On Hold").length,completed:workOrders.filter(w=>w.status==="Completed").length};
  return (<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <Stat label="Open" value={stats.open} color={BL}/>
      <Stat label="In Progress" value={stats.inProgress} color={AM}/>
      <Stat label="On Hold" value={stats.onHold} color={MU}/>
      <Stat label="Completed" value={stats.completed} color={GR}/>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search work orders..." style={{flex:1,minWidth:200,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
      <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}><option value="all">All Statuses</option>{WO_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}><option value="all">All Priorities</option>{WO_PRIORITIES.map(p=><option key={p}>{p}</option>)}</select>
      <Btn onClick={openAdd} v="primary" disabled={!canEdit}>+ New Work Order</Btn>
    </div>
    <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
      {filtered.length===0 ? <div style={{padding:40,textAlign:"center",color:MU}}>No work orders found.</div> : (<table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"#f8f9fc"}}>{["Title","Assigned","Priority","Status","Created","Equipment",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(w=>{const eq=w.equipmentId?equipment.find(e=>e.id===w.equipmentId):null;return (<tr key={w.id} onClick={()=>setDetail(w)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={evt=>evt.currentTarget.style.background="#f8f9fc"} onMouseLeave={evt=>evt.currentTarget.style.background=W}>
          <td style={{padding:"10px 14px"}}><div style={{fontSize:13,fontWeight:500,color:N}}>{w.title}</div>{w.description && <div style={{fontSize:11,color:MU,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:280}}>{w.description}</div>}</td>
          <td style={{padding:"10px 14px",fontSize:12}}>{w.assignedName||"Unassigned"}</td>
          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:PRI_COLORS[w.priority]+"22",color:PRI_COLORS[w.priority],borderRadius:20,padding:"2px 9px",fontWeight:500}}>{w.priority}</span></td>
          <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:WO_STATUS_COLORS[w.status]+"22",color:WO_STATUS_COLORS[w.status],borderRadius:20,padding:"2px 9px",fontWeight:500}}>{w.status}</span></td>
          <td style={{padding:"10px 14px",fontSize:12,color:MU}}>{fd(w.createdDate)}</td>
          <td style={{padding:"10px 14px",fontSize:12,color:MU}}>{eq?eq.name:"—"}</td>
          <td style={{padding:"10px 14px"}} onClick={evt=>evt.stopPropagation()}><div style={{display:"flex",gap:5}}><Btn onClick={()=>openEdit(w)} v="ghost" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>Edit</Btn><Btn onClick={()=>del(w.id)} v="danger" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>X</Btn></div></td>
        </tr>);})}</tbody>
      </table>)}
    </div>
    <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Work Order":"Create Work Order"} width={520}>
      <Fld label="Title *"><Inp value={form.title} onChange={sf("title")} placeholder="e.g. Replace speaker in fellowship hall"/></Fld>
      <Fld label="Description"><textarea value={form.description} onChange={e=>sf("description")(e.target.value)} rows={3} placeholder="Describe the issue..." style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/></Fld>
      <Fld label="Related Equipment (optional)"><select value={form.equipmentId||""} onChange={e=>sf("equipmentId")(+e.target.value||null)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}><option value="">Not related to specific equipment</option>{equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.location})</option>)}</select></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Priority"><Slt value={form.priority} onChange={sf("priority")} opts={WO_PRIORITIES}/></Fld><Fld label="Status"><Slt value={form.status} onChange={sf("status")} opts={WO_STATUSES}/></Fld></div>
      <Fld label="Assigned To"><AssigneePicker value={{type:form.assignedType,userId:form.assignedUserId,memberId:form.assignedMemberId,name:form.assignedName}} onChange={v=>setForm(f=>({...f,assignedType:v.type,assignedUserId:v.userId,assignedMemberId:v.memberId,assignedName:v.name}))} users={users} members={members}/></Fld>
      <Fld label="Created Date"><Inp type="date" value={form.createdDate} onChange={sf("createdDate")}/></Fld>
      <div style={{display:"flex",gap:8}}><Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save Work Order</Btn><Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
    </Modal>
    <Modal open={!!detail} onClose={()=>{setDetail(null);setUpdateNote("");}} title="" width={580}>
      {detail && (()=>{const eq=detail.equipmentId?equipment.find(e=>e.id===detail.equipmentId):null;return (<div style={{marginTop:-14}}>
        <div style={{paddingBottom:14,borderBottom:"0.5px solid "+BR,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
            <div><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:3}}>Work Order #{detail.id}</div><div style={{fontSize:18,fontWeight:500,color:N}}>{detail.title}</div></div>
            <div style={{display:"flex",gap:5,flexShrink:0}}><Btn onClick={()=>{setDetail(null);openEdit(detail);}} v="ghost" style={{fontSize:12,padding:"4px 10px"}} disabled={!canEdit}>Edit</Btn><Btn onClick={()=>{del(detail.id);setDetail(null);}} v="danger" style={{fontSize:12,padding:"4px 10px"}} disabled={!canEdit}>Delete</Btn></div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><span style={{fontSize:11,background:PRI_COLORS[detail.priority]+"22",color:PRI_COLORS[detail.priority],borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.priority} Priority</span><span style={{fontSize:11,background:WO_STATUS_COLORS[detail.status]+"22",color:WO_STATUS_COLORS[detail.status],borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.status}</span></div>
        </div>
        {canEdit && detail.status!=="Completed" && <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}><span style={{fontSize:11,color:MU}}>Change status:</span>{WO_STATUSES.filter(s=>s!==detail.status).map(s=><button key={s} onClick={()=>changeStatus(detail,s)} style={{padding:"4px 10px",borderRadius:6,border:"0.5px solid "+BR,background:W,color:WO_STATUS_COLORS[s],fontSize:11,cursor:"pointer",fontWeight:500}}>{s}</button>)}</div>}
        {detail.description && <div style={{marginBottom:14}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:4}}>Description</div><div style={{fontSize:13,lineHeight:1.6,padding:"10px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}>{detail.description}</div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>{[["Assigned To",detail.assignedName||"Unassigned"],["Created",fd(detail.createdDate)],["Completed",detail.completedDate?fd(detail.completedDate):"—"],["Equipment",eq?eq.name:"—"]].map(([k,v])=>(<div key={k} style={{background:BG,borderRadius:8,padding:"8px 12px",border:"0.5px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>{k}</div><div style={{fontSize:13,fontWeight:500,marginTop:2}}>{v}</div></div>))}</div>
        <div><div style={{fontSize:12,fontWeight:500,color:N,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Updates & Notes ({(detail.updates||[]).length})</div>
          {(detail.updates||[]).length===0 && <div style={{fontSize:12,color:MU,fontStyle:"italic",marginBottom:10}}>No updates yet.</div>}
          {(detail.updates||[]).map((u,i)=>(<div key={i} style={{padding:"8px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR,marginBottom:6}}><div style={{fontSize:11,color:MU,marginBottom:3}}>{fd(u.date)}</div><div style={{fontSize:12,lineHeight:1.5}}>{u.note}</div></div>))}
          {canEdit && <div style={{display:"flex",gap:8,marginTop:10}}><input value={updateNote} onChange={e=>setUpdateNote(e.target.value)} placeholder="Add an update or note..." style={{flex:1,padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/><Btn onClick={addUpdate} v="primary" style={{fontSize:12}}>Add</Btn></div>}
        </div>
      </div>);})()}
    </Modal>
  </div>);
}

function SchedMaintTab({schedMaint,setSchedMaint,equipment,users,members,canEdit}){
  const [search,setSearch]=useState("");
  const [filterStatus,setFilterStatus]=useState("all");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [completeModal,setCompleteModal]=useState(null);
  const [completeDate,setCompleteDate]=useState(td());
  const [completeNotes,setCompleteNotes]=useState("");
  const [form,setForm]=useState({equipmentId:null,taskName:"",frequency:"Monthly",lastService:"",nextService:"",assignedType:"free",assignedUserId:null,assignedMemberId:null,assignedName:"",active:true,notes:""});
  const nid=useRef(6000);
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const filtered=schedMaint.filter(s=>{const eq=equipment.find(e=>e.id===s.equipmentId);if(search&&!((eq?.name||"")+" "+s.taskName+" "+(s.assignedName||"")).toLowerCase().includes(search.toLowerCase())) return false;if(filterStatus==="overdue") return maintStatus(s)?.label==="Overdue";if(filterStatus==="urgent") return maintStatus(s)?.label==="Urgent";if(filterStatus==="upcoming") return maintStatus(s)?.label==="Upcoming";if(filterStatus==="ontrack") return maintStatus(s)?.label==="On Track";if(filterStatus==="inactive") return !s.active;return true;});
  const openAdd=()=>{if(!canEdit){alert("Permission required.");return;}setEditing(null);setForm({equipmentId:null,taskName:"",frequency:"Monthly",lastService:"",nextService:"",assignedType:"free",assignedUserId:null,assignedMemberId:null,assignedName:"",active:true,notes:""});setModal(true);};
  const openEdit=s=>{if(!canEdit){alert("Permission required.");return;}setEditing(s);setForm({...s});setModal(true);};
  const save=()=>{if(!form.taskName||!form.equipmentId){alert("Equipment and task name required.");return;}const data={...form};if(data.lastService && !data.nextService) data.nextService=computeNextService(data.lastService,data.frequency);if(editing) setSchedMaint(ss=>ss.map(s=>s.id===editing.id?{...s,...data}:s));else setSchedMaint(ss=>[...ss,{...data,id:nid.current++}]);setModal(false);};
  const del=id=>{if(!canEdit){alert("Permission required.");return;}if(confirm("Delete this scheduled maintenance?")) setSchedMaint(ss=>ss.filter(s=>s.id!==id));};
  const doComplete=()=>{const s=completeModal;const next=computeNextService(completeDate,s.frequency);const update={...s,lastService:completeDate,nextService:next};if(completeNotes.trim()) update.notes=(update.notes?update.notes+"\n":"")+"["+completeDate+"] "+completeNotes.trim();setSchedMaint(ss=>ss.map(x=>x.id===s.id?update:x));setCompleteModal(null);setCompleteDate(td());setCompleteNotes("");};
  return (<div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search scheduled tasks..." style={{flex:1,minWidth:200,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
      <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}><option value="all">All Statuses</option><option value="overdue">Overdue</option><option value="urgent">Urgent</option><option value="upcoming">Upcoming</option><option value="ontrack">On Track</option><option value="inactive">Inactive</option></select>
      <Btn onClick={openAdd} v="primary" disabled={!canEdit}>+ Schedule Maintenance</Btn>
    </div>
    <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
      {filtered.length===0 ? <div style={{padding:40,textAlign:"center",color:MU}}>No scheduled maintenance.</div> : (<table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"#f8f9fc"}}>{["Equipment","Task","Frequency","Last Service","Next Service","Status","Assigned",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(s=>{const eq=equipment.find(e=>e.id===s.equipmentId);const st=maintStatus(s);return (<tr key={s.id} style={{borderBottom:"0.5px solid "+BR,opacity:s.active?1:0.5}}>
          <td style={{padding:"10px 14px",fontSize:13,fontWeight:500}}>{eq?eq.name:"—"}</td>
          <td style={{padding:"10px 14px",fontSize:13}}>{s.taskName}</td>
          <td style={{padding:"10px 14px",fontSize:12}}><span style={{fontSize:11,background:BG,color:TX,borderRadius:4,padding:"2px 8px",fontWeight:500}}>{s.frequency}</span></td>
          <td style={{padding:"10px 14px",fontSize:12}}>{fd(s.lastService)}</td>
          <td style={{padding:"10px 14px",fontSize:12,fontWeight:500,color:st?st.color:TX}}>{fd(s.nextService)}</td>
          <td style={{padding:"10px 14px"}}>{st?<span style={{fontSize:11,background:st.bg,color:st.color,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{st.label}</span>:<span style={{color:MU,fontSize:11}}>Inactive</span>}</td>
          <td style={{padding:"10px 14px",fontSize:12}}>{s.assignedName||"—"}</td>
          <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:5}}>{canEdit && s.active && <Btn onClick={()=>{setCompleteModal(s);setCompleteDate(td());setCompleteNotes("");}} v="success" style={{fontSize:11,padding:"3px 8px"}}>Complete</Btn>}<Btn onClick={()=>openEdit(s)} v="ghost" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>Edit</Btn><Btn onClick={()=>del(s.id)} v="danger" style={{fontSize:11,padding:"3px 8px"}} disabled={!canEdit}>X</Btn></div></td>
        </tr>);})}</tbody>
      </table>)}
    </div>
    <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Scheduled Maintenance":"Schedule Recurring Maintenance"} width={500}>
      <Fld label="Equipment *"><select value={form.equipmentId||""} onChange={e=>sf("equipmentId")(+e.target.value||null)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}><option value="">Select equipment</option>{equipment.filter(e=>e.status==="Active").map(e=><option key={e.id} value={e.id}>{e.name} ({e.location})</option>)}</select></Fld>
      <Fld label="Task Name *"><Inp value={form.taskName} onChange={sf("taskName")} placeholder="e.g. Filter replacement, Oil change..."/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Frequency"><Slt value={form.frequency} onChange={v=>{sf("frequency")(v);if(form.lastService)sf("nextService")(computeNextService(form.lastService,v));}} opts={MAINT_FREQS}/></Fld><Fld label="Active"><div style={{display:"flex",gap:6}}><button onClick={()=>sf("active")(true)} style={{flex:1,padding:"7px",borderRadius:7,border:"0.5px solid "+(form.active?GR:BR),background:form.active?GR:W,color:form.active?"#fff":TX,fontSize:12,cursor:"pointer"}}>Active</button><button onClick={()=>sf("active")(false)} style={{flex:1,padding:"7px",borderRadius:7,border:"0.5px solid "+(!form.active?MU:BR),background:!form.active?MU:W,color:!form.active?"#fff":TX,fontSize:12,cursor:"pointer"}}>Paused</button></div></Fld></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Last Service"><Inp type="date" value={form.lastService} onChange={v=>{sf("lastService")(v);if(v)sf("nextService")(computeNextService(v,form.frequency));}}/></Fld><Fld label="Next Service"><Inp type="date" value={form.nextService} onChange={sf("nextService")}/></Fld></div>
      <Fld label="Assigned To"><AssigneePicker value={{type:form.assignedType,userId:form.assignedUserId,memberId:form.assignedMemberId,name:form.assignedName}} onChange={v=>setForm(f=>({...f,assignedType:v.type,assignedUserId:v.userId,assignedMemberId:v.memberId,assignedName:v.name}))} users={users} members={members}/></Fld>
      <Fld label="Notes"><Inp value={form.notes} onChange={sf("notes")}/></Fld>
      <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11,color:BL,lineHeight:1.5}}><strong>Auto-calc:</strong> Next service date = Last Service + frequency. Clicking "Complete" rolls dates forward automatically.</div>
      <div style={{display:"flex",gap:8}}><Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save Schedule</Btn><Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
    </Modal>
    <Modal open={!!completeModal} onClose={()=>setCompleteModal(null)} title="Complete Maintenance Task" width={420}>
      {completeModal && (()=>{const eq=equipment.find(e=>e.id===completeModal.equipmentId);const nextDate=computeNextService(completeDate,completeModal.frequency);return (<div>
        <div style={{background:BG,borderRadius:8,padding:"10px 14px",marginBottom:14,border:"0.5px solid "+BR}}><div style={{fontSize:13,fontWeight:500}}>{eq?eq.name:"—"}</div><div style={{fontSize:12,color:MU,marginTop:2}}>{completeModal.taskName} · {completeModal.frequency}</div></div>
        <Fld label="Service Date *"><Inp type="date" value={completeDate} onChange={setCompleteDate}/></Fld>
        <Fld label="Service Notes (optional)"><textarea value={completeNotes} onChange={e=>setCompleteNotes(e.target.value)} rows={3} placeholder="What was done, parts used, etc..." style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/></Fld>
        <div style={{background:"#f0fdf4",border:"0.5px solid "+GR+"55",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#14532d"}}><strong>Next service:</strong> {fd(nextDate)} ({completeModal.frequency} cycle)</div>
        <div style={{display:"flex",gap:8}}><Btn onClick={doComplete} v="success" style={{flex:1,justifyContent:"center"}}>Log & Schedule Next</Btn><Btn onClick={()=>setCompleteModal(null)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
      </div>);})()}
    </Modal>
  </div>);
}

function MaintReports({equipment,workOrders,schedMaint}){
  const totalCost=equipment.reduce((a,e)=>a+(+e.cost||0),0);
  const byCat={};equipment.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+1;});
  const woByPriority={};WO_PRIORITIES.forEach(p=>{woByPriority[p]=workOrders.filter(w=>w.priority===p).length;});
  const completedThisMonth=workOrders.filter(w=>w.status==="Completed"&&w.completedDate?.startsWith("2026-04")).length;
  const avgResolutionDays=(()=>{const done=workOrders.filter(w=>w.status==="Completed"&&w.createdDate&&w.completedDate);if(done.length===0) return 0;return Math.round(done.reduce((a,w)=>a+daysBetween(w.createdDate,w.completedDate),0)/done.length);})();
  const maintHistory=schedMaint.filter(s=>s.lastService).sort((a,b)=>b.lastService.localeCompare(a.lastService)).slice(0,10);
  return (<div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <Stat label="Total Equipment" value={equipment.length}/>
      <Stat label="Total Asset Value" value={"$"+totalCost.toLocaleString()} color={GR}/>
      <Stat label="Work Orders YTD" value={workOrders.length} color={BL}/>
      <Stat label="Completed This Month" value={completedThisMonth} color={GR}/>
      <Stat label="Avg Resolution" value={avgResolutionDays+" days"} color={AM}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 12px"}}>Equipment by Category</h3>
        {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,n])=>{const pct=equipment.length?Math.round(n/equipment.length*100):0;return (<div key={cat} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}><span style={{color:MCAT_COLORS[cat]}}>{cat}</span><span style={{fontWeight:500}}>{n} ({pct}%)</span></div><div style={{height:5,background:BG,borderRadius:3,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:MCAT_COLORS[cat]}}></div></div></div>);})}
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 12px"}}>Work Orders by Priority</h3>
        {WO_PRIORITIES.map(p=>{const n=woByPriority[p];const pct=workOrders.length?Math.round(n/workOrders.length*100):0;return (<div key={p} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}><span style={{color:PRI_COLORS[p]}}>{p}</span><span style={{fontWeight:500}}>{n}</span></div><div style={{height:5,background:BG,borderRadius:3,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:PRI_COLORS[p]}}></div></div></div>);})}
      </div>
    </div>
    {maintHistory.length>0 && <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
      <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 12px"}}>Recent Maintenance History</h3>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"#f8f9fc"}}>{["Date","Equipment","Task","Performed By"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
        <tbody>{maintHistory.map(s=>{const eq=equipment.find(e=>e.id===s.equipmentId);return (<tr key={s.id} style={{borderBottom:"0.5px solid "+BR}}><td style={{padding:"7px 10px"}}>{fd(s.lastService)}</td><td style={{padding:"7px 10px",fontWeight:500}}>{eq?eq.name:"—"}</td><td style={{padding:"7px 10px"}}>{s.taskName}</td><td style={{padding:"7px 10px",color:MU}}>{s.assignedName||"—"}</td></tr>);})}</tbody>
      </table>
    </div>}
  </div>);
}

function Maintenance({users,members,currentUser,roles,permissions,equipment,setEquipment,workOrders,setWorkOrders,schedMaint,setSchedMaint}){
  const [tab,setTab]=useState("dashboard");
  const alerts=computeMaintAlerts(equipment,schedMaint);
  const totalAlerts=alerts.overdue.length+alerts.urgent.length+alerts.warrantyExpired.length+alerts.warrantyExpiringSoon.length;
  const isAdmin=currentUser?.superAdmin||(currentUser?.roleId&&roles?.find(r=>r.id===currentUser.roleId)?.name==="Administrator");
  const canEdit=isAdmin||checkPermission(currentUser,roles,permissions,"maintenance","edit");
  const TABS=[{id:"dashboard",label:"Dashboard"},{id:"equipment",label:"Equipment",count:equipment.filter(e=>e.status==="Active").length},{id:"workorders",label:"Work Orders",count:workOrders.filter(w=>w.status!=="Completed").length},{id:"scheduled",label:"Scheduled",count:schedMaint.filter(s=>s.active).length},{id:"reports",label:"Reports"}];
  return (<div>
    {totalAlerts>0 && <MaintAlertBanner alerts={alerts}/>}
    <div style={{display:"flex",marginBottom:20,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
      {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===t.id?G:"transparent"),background:tab===t.id?"#f8f9fc":W,fontSize:13,fontWeight:tab===t.id?500:400,color:tab===t.id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>{t.label}{t.count!==undefined && t.count>0 && <span style={{background:N+"22",color:N,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{t.count}</span>}{t.id==="dashboard" && totalAlerts>0 && <span style={{background:RE,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:600}}>{totalAlerts}</span>}</button>))}
    </div>
    {tab==="dashboard" && <MaintDashboard equipment={equipment} workOrders={workOrders} schedMaint={schedMaint} alerts={alerts} setTab={setTab}/>}
    {tab==="equipment" && <EquipmentTab equipment={equipment} setEquipment={setEquipment} workOrders={workOrders} schedMaint={schedMaint} canEdit={canEdit}/>}
    {tab==="workorders" && <WorkOrdersTab workOrders={workOrders} setWorkOrders={setWorkOrders} equipment={equipment} users={users} members={members} canEdit={canEdit}/>}
    {tab==="scheduled" && <SchedMaintTab schedMaint={schedMaint} setSchedMaint={setSchedMaint} equipment={equipment} users={users} members={members} canEdit={canEdit}/>}
    {tab==="reports" && <MaintReports equipment={equipment} workOrders={workOrders} schedMaint={schedMaint}/>}
  </div>);
}

// ── CHURCH SETTINGS & DOWNLOAD ──
const DEFAULT_CS={name:"New Testament Christian Church",pastorName:"Pastor R. E. Hall",address:"Glendale, AZ",phone:"",email:"",logoUrl:""};

async function downloadApp(cs, d) {
  const today = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const f$ = n => "$"+Number(n||0).toLocaleString();
  const fd2 = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
  const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const row = (...cells) => `<tr>${cells.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`;
  const hrow = (...cells) => `<tr>${cells.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
  const section = (title,color,content) => `<div class="section"><div class="sec-header" style="border-left:4px solid ${color}">${title}</div>${content}</div>`;
  const table = (headers,rows) => `<table><thead>${hrow(...headers)}</thead><tbody>${rows.join("")}</tbody></table>`;

  const activeM = (d.members||[]).filter(m=>m.status==="Active").length;
  const totalGiving = (d.giving||[]).reduce((a,g)=>a+(+g.amount||0),0);
  const openWOs = (d.workOrders||[]).filter(w=>w.status!=="Completed").length;
  const overdueMaint = (d.schedMaint||[]).filter(s=>s.active&&s.nextService&&s.nextService<new Date().toISOString().split("T")[0]).length;

  const logoHtml = cs.logoUrl
    ? `<img src="${esc(cs.logoUrl)}" style="height:54px;object-fit:contain;margin-bottom:6px" alt="logo"/>`
    : `<div style="width:54px;height:54px;background:#1a2e5a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#c9a84c;font-weight:700;font-size:16px;margin:0 auto 6px">${esc((cs.name||"CH").split(" ").filter(w=>w).slice(0,2).map(w=>w[0]).join("").toUpperCase())}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(cs.name)} — Church Data Export</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#1f2937;background:#f4f6fb;padding:20px}
  .page{max-width:1100px;margin:0 auto}
  .header{background:#1a2e5a;color:#fff;border-radius:12px;padding:24px 28px;margin-bottom:20px;display:flex;align-items:center;gap:20px}
  .header-logo{text-align:center;flex-shrink:0}
  .header-info h1{font-size:22px;font-weight:500;margin-bottom:4px}
  .header-info p{font-size:13px;opacity:0.7;margin-bottom:2px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi{background:#fff;border:0.5px solid #e2e5ec;border-radius:10px;padding:14px 16px}
  .kpi-val{font-size:24px;font-weight:600;margin-bottom:2px}
  .kpi-lbl{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}
  .section{background:#fff;border:0.5px solid #e2e5ec;border-radius:12px;padding:18px;margin-bottom:16px}
  .sec-header{font-size:14px;font-weight:600;color:#1a2e5a;padding-left:10px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f8f9fc;padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e5ec}
  td{padding:8px 12px;border-bottom:0.5px solid #e2e5ec;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:500}
  .green{background:#dcfce7;color:#15803d}
  .red{background:#fee2e2;color:#dc2626}
  .amber{background:#fef9c3;color:#854d0e}
  .blue{background:#dbeafe;color:#1d4ed8}
  .footer{text-align:center;padding:16px;font-size:11px;color:#9ca3af;margin-top:8px}
  @media print{body{background:#fff;padding:0}.page{max-width:100%}.section{break-inside:avoid}}
</style></head>
<body><div class="page">
<div class="header">
  <div class="header-logo">${logoHtml}</div>
  <div class="header-info">
    <h1>${esc(cs.name)}</h1>
    <p>${esc(cs.pastorName)}</p>
    ${cs.address?`<p>${esc(cs.address)}</p>`:""}
    ${cs.phone?`<p>${esc(cs.phone)}</p>`:""}
    ${cs.email?`<p>${esc(cs.email)}</p>`:""}
    <p style="margin-top:8px;font-size:11px;opacity:0.5">Exported: ${today}</p>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-val" style="color:#1a2e5a">${activeM}</div><div class="kpi-lbl">Active Members</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${f$(totalGiving)}</div><div class="kpi-lbl">Total Giving on Record</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#d97706">${openWOs}</div><div class="kpi-lbl">Open Work Orders</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${overdueMaint}</div><div class="kpi-lbl">Overdue Maintenance</div></div>
</div>

${section("Member Directory","#1a2e5a", table(
  ["Name","Role","Status","Phone","Email","Member Since","Family"],
  (d.members||[]).map(m=>row(
    (m.first||"")+" "+(m.last||""),
    m.role||"Member",
    m.status||"",
    m.phone||"",
    m.email||"",
    fd2(m.joined),
    m.family||""
  ))
))}

${section("Visitors","#7c3aed", table(
  ["Name","Stage","Phone","Email","First Visit","Sponsor","Notes"],
  (d.visitors||[]).map(v=>row(
    (v.first||"")+" "+(v.last||""),
    v.stage||"",
    v.phone||"",
    v.email||"",
    fd2(v.firstVisit),
    v.sponsor||"",
    v.notes||""
  ))
))}

${section("Attendance Log","#2563eb", table(
  ["Date","Service","Total","Members","Visitors","Notes"],
  [...(d.attendance||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>row(
    fd2(a.date),a.service||"",a.count||0,a.members||0,a.visitors||0,a.notes||""
  ))
))}

${section("Giving Records","#16a34a", table(
  ["Date","Name","Category","Amount","Method","Notes"],
  [...(d.giving||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(g=>row(
    fd2(g.date),g.name||"",g.category||"",f$(g.amount),g.method||"",g.notes||""
  ))
))}

${section("Equipment","#0891b2", table(
  ["Name","Category","Location","Serial","Warranty Expires","Status","Value"],
  (d.equipment||[]).map(e=>row(
    e.name||"",e.category||"",e.location||"",
    e.serial||"",fd2(e.warrantyExpires),e.status||"",f$(e.cost)
  ))
))}

${section("Work Orders","#ea580c", table(
  ["Title","Priority","Status","Assigned To","Created","Completed","Description"],
  (d.workOrders||[]).map(w=>row(
    w.title||"",w.priority||"",w.status||"",
    w.assignedName||"",fd2(w.createdDate),
    w.completedDate?fd2(w.completedDate):"Open",
    w.description||""
  ))
))}

${section("Scheduled Maintenance","#d97706", table(
  ["Equipment","Task","Frequency","Last Service","Next Service","Assigned To"],
  (d.schedMaint||[]).map(s=>{
    const eq=(d.equipment||[]).find(e=>e.id===s.equipmentId);
    return row(eq?eq.name:"—",s.taskName||"",s.frequency||"",
      fd2(s.lastService),fd2(s.nextService),s.assignedName||"");
  })
))}

${section("Prayer Requests","#7c3aed", table(
  ["Name","Request","Date","Status"],
  (d.prayers||[]).map(p=>row(p.name||"Anonymous",p.request||"",fd2(p.date),p.status||""))
))}

<div class="footer">${esc(cs.name)} — Exported on ${today} — NTCC AI Church Database v5</div>
</div></body></html>`;

  const fname = (cs.name||"Church").replace(/[^a-z0-9]/gi,"_")+"_Export_"+new Date().toISOString().slice(0,10)+".html";
  const blob = new Blob([html],{type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"),{href:url,download:fname});
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
}

function SetupModal({onSave}){
  const [form,setForm]=useState({...DEFAULT_CS});
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  return (<div style={{position:"fixed",inset:0,background:"#00000099",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:W,borderRadius:14,width:520,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",padding:28,boxSizing:"border-box"}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{width:56,height:56,borderRadius:14,background:N,color:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,margin:"0 auto 12px"}}>✦</div>
        <h2 style={{fontSize:20,fontWeight:500,color:N,margin:0}}>Welcome — Set Up Your Church</h2>
        <p style={{fontSize:13,color:MU,marginTop:6}}>Personalize the app with your church information. You can change this anytime in Settings.</p>
      </div>
      <Fld label="Church Name *"><Inp value={form.name} onChange={sf("name")} placeholder="e.g. Grace Community Church"/></Fld>
      <Fld label="Pastor Name *"><Inp value={form.pastorName} onChange={sf("pastorName")} placeholder="e.g. Pastor John Smith"/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="City / Address"><Inp value={form.address} onChange={sf("address")} placeholder="e.g. Phoenix, AZ"/></Fld>
        <Fld label="Phone"><Inp value={form.phone} onChange={sf("phone")} placeholder="(623) 555-0100"/></Fld>
      </div>
      <Fld label="Email"><Inp value={form.email} onChange={sf("email")} placeholder="info@yourchurch.org"/></Fld>
      <Fld label="Logo URL (optional)"><Inp value={form.logoUrl} onChange={sf("logoUrl")} placeholder="https://yourchurch.org/logo.png"/></Fld>
      {form.logoUrl&&<div style={{textAlign:"center",marginBottom:8}}><img src={form.logoUrl} style={{maxHeight:60,maxWidth:200,objectFit:"contain",borderRadius:6,border:"0.5px solid "+BR}} alt="preview" onError={e=>e.target.style.display="none"}/></div>}
      <Btn onClick={()=>{if(!form.name.trim()||!form.pastorName.trim()){alert("Church name and pastor name required.");return;}onSave(form);}} style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14,marginTop:8}}>Save and Launch App</Btn>
    </div>
  </div>);
}

function ChurchSettingsPage({cs,setCs,members,setMembers,visitors,attendance,giving,prayers,groups,grpMeetings,visitRecords,checkIns,kidsCheckIns,children,pledgeDrives,pledges,weeklyReports,equipment,workOrders,schedMaint}:any){
  const [form,setForm]=useState({...cs});
  const [saved,setSaved]=useState(false);
  const [stab,setStab]=useState('general');
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const save=()=>{setCs({...form});setSaved(true);setTimeout(()=>setSaved(false),2500);};
  const allData={members,visitors,attendance,giving,prayers,groups,grpMeetings,visitRecords,checkIns,kidsCheckIns,children,pledgeDrives,pledges,weeklyReports,equipment,workOrders,schedMaint};
  const logoInitials=(form.name||"AI").split(" ").filter(w=>w).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  return (<div>
    {/* Tab bar */}
    <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'1.5px solid '+BR,paddingBottom:0}}>
      {[{id:'general',label:'⚙ General'},{id:'merge',label:'🔀 Merge Tool'}].map(t=>(
        <button key={t.id} onClick={()=>setStab(t.id)} style={{padding:'8px 18px',fontSize:13,fontWeight:stab===t.id?600:400,color:stab===t.id?N:MU,background:'none',border:'none',borderBottom:stab===t.id?'2.5px solid '+N:'2.5px solid transparent',cursor:'pointer',marginBottom:-1.5}}>{t.label}</button>
      ))}
    </div>
    {stab==='merge'&&<MergeTool members={members} setMembers={setMembers}/>}
    {stab==='general'&&<div>
    {saved&&<div style={{background:"#dcfce7",border:"0.5px solid #86efac",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#14532d",fontWeight:500}}>Settings saved successfully.</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Church Information</h3>
        <Fld label="Church Name *"><Inp value={form.name} onChange={sf("name")}/></Fld>
        <Fld label="Pastor Name *"><Inp value={form.pastorName} onChange={sf("pastorName")}/></Fld>
        <Fld label="Address / City"><Inp value={form.address} onChange={sf("address")}/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Phone"><Inp value={form.phone} onChange={sf("phone")}/></Fld>
          <Fld label="Email"><Inp value={form.email} onChange={sf("email")}/></Fld>
        </div>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Logo</h3>
        <Fld label="Logo URL (image link)"><Inp value={form.logoUrl} onChange={sf("logoUrl")} placeholder="https://yourchurch.org/logo.png"/></Fld>
        {form.logoUrl?<div style={{padding:12,background:BG,borderRadius:8,border:"0.5px solid "+BR,textAlign:"center",marginTop:8}}><img src={form.logoUrl} style={{maxHeight:70,maxWidth:"100%",objectFit:"contain",borderRadius:6}} alt="logo" onError={e=>e.target.style.display="none"}/></div>:<div style={{padding:20,background:N+"0a",borderRadius:8,border:"0.5px dashed "+N+"44",textAlign:"center",color:MU,fontSize:12,marginTop:8}}>Enter a URL above to preview your logo</div>}
        <div style={{marginTop:12,padding:"10px 12px",background:N,borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
          {form.logoUrl?<img src={form.logoUrl} style={{width:32,height:32,borderRadius:7,objectFit:"cover",flexShrink:0,border:"1px solid #ffffff33"}} alt="" onError={e=>e.target.style.display="none"}/>:<div style={{width:32,height:32,borderRadius:7,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{logoInitials}</div>}
          <div style={{minWidth:0}}><div style={{color:"#fff",fontWeight:500,fontSize:12,lineHeight:1.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{form.name||"Your Church"}</div><div style={{color:"#7a9acc",fontSize:10,marginTop:1}}>{form.pastorName||"Pastor Name"}</div></div>
        </div>
      </div>
    </div>
    <div style={{background:W,border:"1.5px solid "+G,borderRadius:12,padding:18,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div><h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Download App as HTML</h3><p style={{fontSize:12,color:MU,marginTop:4,marginBottom:0,lineHeight:1.6}}>Creates a self-contained HTML file with all your current data embedded. Open in any browser. Requires internet on first open to load React — then works offline.</p></div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:10}}>
        <Btn onClick={()=>downloadApp(form,allData)} v="gold" style={{fontSize:13,padding:"10px 20px"}}>Download HTML App</Btn>
        <span style={{fontSize:11,color:MU}}>{members.length} members · {visitors.length} visitors · {giving.length} giving records · {equipment.length} equipment items</span>
      </div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <Btn onClick={save} v="success" style={{padding:"11px 24px",fontSize:14}}>Save Settings</Btn>
      <Btn onClick={()=>setForm({...cs})} v="ghost">Reset</Btn>
    </div>
    <div style={{marginTop:24,background:"#fef2f2",border:"1.5px solid "+RE+"55",borderRadius:12,padding:18}}>
      <h3 style={{fontSize:14,fontWeight:600,color:RE,margin:"0 0 6px"}}>Clear All Data — Go Live</h3>
      <p style={{fontSize:12,color:"#7f1d1d",marginBottom:14,lineHeight:1.6}}>This permanently removes ALL records from this browser (members, visitors, giving, attendance, groups, children, prayer, equipment, work orders, etc.) and resets the app to a clean slate. This cannot be undone. Use this to clear test data before going live with real information.</p>
      <Btn onClick={()=>{
        if(!confirm("PERMANENTLY delete ALL data from this browser? This cannot be undone.")) return;
        if(!confirm("Are you absolutely sure? All members, visitors, giving, attendance, and every other record will be erased.")) return;
        const prefix = cs._churchId ? `ntcc_${cs._churchId}_` : "ntcc_";
        const keysToRemove = [];
        for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k.startsWith(prefix)||k.startsWith("ntcc_")))keysToRemove.push(k);}
        keysToRemove.forEach(k=>localStorage.removeItem(k));
        window.location.reload();
      }} v="danger" style={{fontSize:13}}>Clear All Data & Reload</Btn>
    </div>
    </div>}
  </div>);
}

// ── MERGE TOOL ──
function MergeTool({members,setMembers}:any){
  const [step,setStep]=useState<'upload'|'preview'|'done'>('upload');
  const [newOnes,setNewOnes]=useState<any[]>([]);
  const [conflicts,setConflicts]=useState<any[]>([]);
  const [acceptNew,setAcceptNew]=useState<Set<number>>(new Set());
  const [acceptConflict,setAcceptConflict]=useState<Set<number>>(new Set());
  const [choices,setChoices]=useState<any>({});
  const [result,setResult]=useState<any>(null);
  const [err,setErr]=useState('');
  const MF=[
    {key:'first',label:'First Name'},{key:'last',label:'Last Name'},
    {key:'status',label:'Status'},{key:'phone',label:'Phone'},
    {key:'email',label:'Email'},{key:'birthday',label:'Birthday'},
    {key:'anniversary',label:'Anniversary'},{key:'spouseName',label:'Spouse'},
    {key:'joined',label:'Join Date'},
    {key:'address',label:'Address',fmt:(v:any)=>v?[v.street,v.city,v.state,v.zip].filter(Boolean).join(', '):''},
    {key:'children',label:'Children',fmt:(v:any)=>Array.isArray(v)?v.map((c:any)=>c.name).join(', '):(v||'')},
    {key:'gender',label:'Gender'},{key:'notes',label:'Notes'},
  ];
  function mapF(raw:any):any{
    const get=(...keys:string[])=>{for(const k of keys){const found=Object.keys(raw).find(rk=>rk.toLowerCase().replace(/[^a-z]/g,'')===k.toLowerCase().replace(/[^a-z]/g,''));if(found&&raw[found])return String(raw[found]).trim();}return'';};
    const first=get('first','firstname','fname','givenname');
    const last=get('last','lastname','lname','surname','familyname');
    if(!first&&!last)return null;
    return{id:`mrg_${Date.now()}_${Math.random()}`,first,last,
      status:get('status','membershipstatus','membership')||'Active',
      phone:get('phone','phonenumber','mobile','cell','telephone'),
      email:get('email','emailaddress'),
      birthday:get('birthday','birthdate','dob','dateofbirth'),
      anniversary:get('anniversary','anniversarydate','weddingdate'),
      spouseName:get('spouse','spousename','partnername'),
      joined:get('joined','joindate','datejoined','membershipdate','startdate'),
      address:{street:get('address','street','streetaddress'),city:get('city'),state:get('state'),zip:get('zip','zipcode','postalcode')},
      children:(()=>{const c=get('children','child','kids');if(!c)return[];return c.split(/[;|]/).filter(Boolean).map((n:string)=>({name:n.trim(),birthday:''}));})(),
      gender:get('gender','sex'),notes:get('notes','note','comments','remarks'),
      role:get('role','ministry','position','title'),
    };
  }
  function parseCSV(text:string):any[]{
    const lines=text.trim().split(/\r?\n/);if(lines.length<2)return[];
    const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    return lines.slice(1).filter(l=>l.trim()).map(line=>{
      const vals:string[]=[]; let cur='',inQ=false;
      for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){vals.push(cur);cur='';}else cur+=ch;}
      vals.push(cur);
      const obj:any={};headers.forEach((h,i)=>{obj[h]=(vals[i]||'').trim().replace(/^"|"$/g,'');});
      return mapF(obj);
    }).filter(Boolean);
  }
  function process(file:File){
    setErr('');
    const reader=new FileReader();
    reader.onload=(e)=>{
      const text=e.target?.result as string;
      let records:any[]=[];
      try{
        if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);const arr=Array.isArray(data)?data:(data.members||data.data||[]);records=arr.map(mapF).filter(Boolean);}
        else{records=parseCSV(text);}
      }catch{setErr('Could not parse file. Ensure it is valid CSV or JSON.');return;}
      if(!records.length){setErr('No valid member records found in file.');return;}
      const nw:any[]=[],cf:any[]=[];
      records.forEach(inc=>{
        const match=members.find((m:any)=>m.first?.trim().toLowerCase()===inc.first?.trim().toLowerCase()&&m.last?.trim().toLowerCase()===inc.last?.trim().toLowerCase());
        if(match)cf.push({incoming:inc,existing:match});else nw.push(inc);
      });
      setNewOnes(nw);setConflicts(cf);
      setAcceptNew(new Set(nw.map((_,i)=>i)));setAcceptConflict(new Set());
      const defs:any={};cf.forEach((_,ci)=>{defs[ci]={};MF.forEach(f=>{defs[ci][f.key]='existing';});});
      setChoices(defs);setStep('preview');
    };
    reader.readAsText(file);
  }
  function doMerge(){
    let list=[...members];let added=0,upd=0;
    newOnes.forEach((rec,i)=>{if(acceptNew.has(i)){list.push({...rec,id:Date.now()+Math.random()});added++;}});
    conflicts.forEach((c,ci)=>{
      if(acceptConflict.has(ci)){
        const idx=list.findIndex((m:any)=>m.id===c.existing.id);
        if(idx>=0){const u={...list[idx]};MF.forEach(f=>{if(choices[ci]?.[f.key]==='incoming')u[f.key]=c.incoming[f.key];});list[idx]=u;upd++;}
      }
    });
    setMembers(list);setResult({added,merged:upd});setStep('done');
  }
  const fv=(f:any,rec:any)=>{if(f.fmt)return f.fmt(rec[f.key]);return String(rec[f.key]||'');};
  if(step==='done')return(
    <div style={{textAlign:'center',padding:48}}>
      <div style={{fontSize:48,marginBottom:12}}>✅</div>
      <h3 style={{fontSize:18,fontWeight:600,color:N,margin:'0 0 8px'}}>Merge Complete</h3>
      <p style={{color:MU,fontSize:14}}><strong style={{color:GR}}>{result.added}</strong> member{result.added!==1?'s':''} added &nbsp;·&nbsp; <strong style={{color:BL}}>{result.merged}</strong> profile{result.merged!==1?'s':''} updated</p>
      <Btn onClick={()=>{setStep('upload');setResult(null);}} v="ghost" style={{marginTop:16}}>Merge Another File</Btn>
    </div>
  );
  if(step==='preview')return(
    <div>
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{background:'#dcfce7',border:'0.5px solid #86efac',borderRadius:9,padding:'10px 16px',fontSize:13,color:'#14532d',fontWeight:500}}>{newOnes.length} new · {acceptNew.size} selected to add</div>
        <div style={{background:'#fef9c3',border:'0.5px solid #fde047',borderRadius:9,padding:'10px 16px',fontSize:13,color:'#713f12',fontWeight:500}}>{conflicts.length} duplicate{conflicts.length!==1?'s':''} · {acceptConflict.size} to update</div>
      </div>
      {newOnes.length>0&&<div style={{background:W,border:'0.5px solid '+BR,borderRadius:12,padding:18,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{fontSize:14,fontWeight:600,color:N,margin:0}}>New Members to Add ({newOnes.length})</h3>
          <div style={{display:'flex',gap:8}}>
            <Btn v="ghost" onClick={()=>setAcceptNew(new Set(newOnes.map((_,i)=>i)))} style={{fontSize:11,padding:'4px 10px'}}>All</Btn>
            <Btn v="ghost" onClick={()=>setAcceptNew(new Set())} style={{fontSize:11,padding:'4px 10px'}}>None</Btn>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {newOnes.map((rec,i)=>(
            <label key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:acceptNew.has(i)?'#f0fdf4':'#f9fafb',border:'0.5px solid '+(acceptNew.has(i)?'#86efac':BR),borderRadius:8,cursor:'pointer'}}>
              <input type="checkbox" checked={acceptNew.has(i)} onChange={()=>{const s=new Set(acceptNew);s.has(i)?s.delete(i):s.add(i);setAcceptNew(s);}}/>
              <span style={{fontWeight:500,color:TX}}>{rec.first} {rec.last}</span>
              <span style={{fontSize:11,color:MU,marginLeft:6}}>{[rec.phone,rec.email,rec.status].filter(Boolean).join(' · ')}</span>
            </label>
          ))}
        </div>
      </div>}
      {conflicts.length>0&&<div style={{background:W,border:'0.5px solid '+BR,borderRadius:12,padding:18,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:600,color:N,margin:'0 0 4px'}}>Duplicate Members ({conflicts.length})</h3>
        <p style={{fontSize:12,color:MU,marginBottom:14}}>Name already exists. Check to update and choose which field values to keep.</p>
        {conflicts.map((c,ci)=>(
          <div key={ci} style={{border:'0.5px solid '+(acceptConflict.has(ci)?'#93c5fd':BR),borderRadius:10,marginBottom:10,overflow:'hidden'}}>
            <label style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:acceptConflict.has(ci)?'#eff6ff':'#f9fafb',cursor:'pointer'}}>
              <input type="checkbox" checked={acceptConflict.has(ci)} onChange={()=>{const s=new Set(acceptConflict);s.has(ci)?s.delete(ci):s.add(ci);setAcceptConflict(s);}}/>
              <span style={{fontWeight:500,color:TX}}>{c.existing.first} {c.existing.last}</span>
              <span style={{fontSize:11,color:MU,marginLeft:6}}>pick fields to update below</span>
            </label>
            {acceptConflict.has(ci)&&<div style={{padding:14,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  <th style={{padding:'6px 8px',textAlign:'left',color:MU,fontWeight:600,background:'#f9fafb',width:110}}>Field</th>
                  <th style={{padding:'6px 8px',textAlign:'left',color:GR,fontWeight:600,background:'#f0fdf4'}}>✔ Keep Existing</th>
                  <th style={{padding:'6px 8px',textAlign:'left',color:BL,fontWeight:600,background:'#eff6ff'}}>↩ Use Incoming</th>
                </tr></thead>
                <tbody>
                  {MF.map(f=>{
                    const ev=fv(f,c.existing),iv=fv(f,c.incoming);
                    if(!ev&&!iv)return null;
                    const sel=choices[ci]?.[f.key]||'existing';
                    return(<tr key={f.key} style={{borderTop:'0.5px solid '+BR}}>
                      <td style={{padding:'7px 8px',fontWeight:500,color:TX,whiteSpace:'nowrap'}}>{f.label}</td>
                      <td style={{padding:'6px 8px',background:sel==='existing'?'#f0fdf4':''}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                          <input type="radio" name={`fld-${ci}-${f.key}`} checked={sel==='existing'} onChange={()=>setChoices((p:any)=>({...p,[ci]:{...p[ci],[f.key]:'existing'}}))}/>
                          <span style={{fontSize:11,color:ev?TX:MU,fontStyle:ev?'normal':'italic'}}>{ev||'(empty)'}</span>
                        </label>
                      </td>
                      <td style={{padding:'6px 8px',background:sel==='incoming'?'#eff6ff':''}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                          <input type="radio" name={`fld-${ci}-${f.key}`} checked={sel==='incoming'} onChange={()=>setChoices((p:any)=>({...p,[ci]:{...p[ci],[f.key]:'incoming'}}))}/>
                          <span style={{fontSize:11,color:iv?TX:MU,fontStyle:iv?'normal':'italic'}}>{iv||'(empty)'}</span>
                        </label>
                      </td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        ))}
      </div>}
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={doMerge} v="success" style={{fontSize:14,padding:'10px 24px'}}>Confirm Merge ({acceptNew.size+acceptConflict.size} records)</Btn>
        <Btn onClick={()=>setStep('upload')} v="ghost">← Back</Btn>
      </div>
    </div>
  );
  return(
    <div>
      <p style={{fontSize:13,color:MU,marginBottom:20,lineHeight:1.7}}>Import member profiles from another church's database. Detects duplicates by first+last name and lets you choose which field values to keep.</p>
      {err&&<div style={{background:'#fee2e2',border:'0.5px solid #fca5a5',borderRadius:8,padding:'10px 14px',color:'#b91c1c',fontSize:13,marginBottom:14}}>{err}</div>}
      <div
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)process(f);}}
        onClick={()=>document.getElementById('merge-file-inp')?.click()}
        style={{border:'2px dashed #c7d2fe',borderRadius:14,padding:48,textAlign:'center',background:'#f5f3ff',cursor:'pointer'}}
      >
        <div style={{fontSize:40,marginBottom:8}}>📂</div>
        <div style={{fontWeight:600,color:N,fontSize:15,marginBottom:4}}>Drop CSV or JSON file here</div>
        <div style={{color:MU,fontSize:12}}>or click to browse</div>
        <input id="merge-file-inp" type="file" accept=".csv,.json" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)process(f);(e.target as any).value='';}}/>
      </div>
      <div style={{marginTop:16,background:'#f8fafc',border:'0.5px solid '+BR,borderRadius:10,padding:14}}>
        <div style={{fontWeight:500,color:N,fontSize:13,marginBottom:6}}>Expected CSV columns (flexible naming):</div>
        <div style={{fontSize:11,color:MU,lineHeight:1.9,flexWrap:'wrap',display:'flex',gap:4}}>
          {['First Name','Last Name','Phone','Email','Status','Birthday','Anniversary','Spouse','Children (semicolons)','Address','City','State','Zip','Gender','Join Date','Notes'].map(c=>(
            <code key={c} style={{background:'#e0e7ff',borderRadius:3,padding:'1px 6px'}}>{c}</code>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──



const N="#1a2e5a",G="#c9a84c",GL="#f5e9c8",BG="#f4f6fb",W="#fff",BR="#e2e5ec";
const MU="#6b7280",TX="#1f2937",GR="#16a34a",RE="#dc2626",AM="#d97706",BL="#2563eb",PU="#7c3aed",TE="#0891b2";

const EL_KEY="sk_7fd85f85f4f23d141576c41114a2bd693939b9b8ecc81efd";
const SILENT_WAV="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
// Module-level audio element — unlocked once by user gesture, reused forever
const _elAudio = typeof window !== "undefined" ? new Audio() : null as any;
if (_elAudio) { _elAudio.volume = 1; _elAudio.preload = "auto"; }
const EL_VOICES=[
  {id:"flq6f7ib4F8Sfv2nltCn",name:"Michael",desc:"American Male — Deep & Pastoral (Recommended)"},
  {id:"onwK4e9ZLuTAKqWW03F9",name:"Daniel",desc:"British Male — Deep & Authoritative"},
  {id:"pNInz6obpgDQGcFmaJgB",name:"Adam",desc:"American Male — Narration Style"},
  {id:"TxGEqnHWrfWFTfGW9XjX",name:"Josh",desc:"American Male — Deep & Commanding"},
  {id:"ErXwobaYiN019PkySvjV",name:"Antoni",desc:"American Male — Well-Rounded"},
  {id:"21m00Tcm4TlvDq8ikWAM",name:"Rachel",desc:"American Female — Calm & Professional"},
  {id:"nPczCjzI2devNBz1zQrb",name:"Brian",desc:"American Male — Confident & Clear"},
];

const EMPTY_ADDR={street:"",city:"",state:"AZ",zip:""};
const EMPTY_PERSON_FIELDS={address:{...EMPTY_ADDR},birthday:"",anniversary:"",spouseName:"",children:[],emergencyName:"",emergencyPhone:"",emergencyRelation:"",baptismDate:"",salvationDate:"",allergies:[],medical:[],medicalNotes:"",occupation:"",employer:""};
const IMEMBERS:any[]=[];
const IVISITORS:any[]=[];
const IATTEND:any[]=[];
const IGIVING:any[]=[];
const IPRAYERS:any[]=[];

const GROUP_TYPES=["Bible Study","Prayer Group","Ministry Team","Youth Group","Outreach","Worship","Custom"];
const GROUP_COLORS=["#1a2e5a","#c9a84c","#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#be185d","#065f46"];
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const IGROUPS:any[]=[];
const IMEETINGS:any[]=[];

// ── Education Department Constants ──
const CL_COLORS=["#1a2e5a","#c9a84c","#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#be185d","#065f46","#ea580c","#4f46e5","#db2777","#0e7490"];
function levelFromAge(age){if(age<=2)return"Nursery";if(age<=4)return"Pre-K";if(age===5)return"Kindergarten";if(age<=10)return"Elementary";if(age<=13)return"Middle School";if(age<=17)return"High School";return"Young Adult";}
const CHURCH_LEVELS=[
  {id:1,name:"Nursery",grade:"Nursery",ageMin:0,ageMax:2,label:"Nursery (ages 0-2)",location:"Room 101",capacity:10,color:"#1a2e5a",checkin:true},
  {id:2,name:"Pre-K",grade:"Pre-K",ageMin:3,ageMax:4,label:"Pre-K (ages 3-4)",location:"Room 102",capacity:12,color:"#c9a84c",checkin:true},
  {id:3,name:"Kindergarten",grade:"Kindergarten",ageMin:5,ageMax:5,label:"Kindergarten (age 5)",location:"Room 103",capacity:15,color:"#16a34a",checkin:true},
  {id:4,name:"Elementary",grade:"Elementary",ageMin:6,ageMax:10,label:"Elementary (grades 1-5, ages 6-10)",location:"Room 104",capacity:20,color:"#2563eb",checkin:true},
  {id:5,name:"Middle School",grade:"Middle School",ageMin:11,ageMax:13,label:"Middle School (grades 6-8, ages 11-13)",location:"Room 105",capacity:20,color:"#7c3aed",checkin:true},
  {id:6,name:"High School",grade:"High School",ageMin:14,ageMax:17,label:"High School (grades 9-12, ages 14-18)",location:"Room 106",capacity:20,color:"#dc2626",checkin:true},
  {id:7,name:"Young Adult",grade:"Young Adult",ageMin:18,ageMax:99,label:"Young Adult (ages 18+)",location:"Room 107",capacity:25,color:"#d97706",checkin:false},
];
const ICLASSROOMS=CHURCH_LEVELS.map(l=>({...l}));
const ICHILDREN:any[]=[];
const ITEACHERSCHEDULE=[];
const IKIDSCHECKINS=[];
function genCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<4;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}

const MODULES=[
  {key:"directory",label:"Members Profile",icon:"Dir",desc:"Member and visitor records",actions:["view","create","edit","delete"]},
  {key:"visitation",label:"Visitation",icon:"Vis",desc:"Follow-up pipeline and visits",actions:["view","create","edit","delete"]},
  {key:"groups",label:"Groups Ministry",icon:"Grp",desc:"Small groups and attendance",actions:["view","create","edit","delete"]},
  {key:"education",label:"Education",icon:"Edu",desc:"Sunday School and kids check-in",actions:["view","create","edit","delete"]},
  {key:"events",label:"Events & Calendar",icon:"Cal",desc:"Church calendar and check-ins",actions:["view","create","edit","delete"]},
  {key:"attendance",label:"Attendance",icon:"Att",desc:"Service attendance logs",actions:["view","create","edit","delete"]},
  {key:"giving",label:"Giving & Finances",icon:"Fin",desc:"Tithes, pledges, and reports",actions:["view","create","edit","delete"]},
  {key:"prayer",label:"Prayer Wall",icon:"Pry",desc:"Prayer requests",actions:["view","create","edit","delete"]},
  {key:"reports",label:"Reports",icon:"Rpt",desc:"All reports and analytics",actions:["view","create","edit","delete"]},
  {key:"media",label:"Media Library",icon:"Med",desc:"Sermons and files",actions:["view","create","edit","delete"]},
  {key:"settings",label:"System Settings",icon:"Set",desc:"Users, roles, and config",actions:["view","create","edit","delete"]},
];
const PORTAL_PERMS=[
  {key:"viewAttendance",label:"View own attendance"},
  {key:"viewGiving",label:"View own giving"},
  {key:"viewEvents",label:"View upcoming events"},
  {key:"updateAddress",label:"Update address & contact"},
  {key:"submitPrayer",label:"Submit prayer requests"},
];
const ROLE_COLORS=["#1a2e5a","#c9a84c","#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#be185d","#065f46"];
const blankPerms=()=>Object.fromEntries(MODULES.map(m=>[m.key,Object.fromEntries(m.actions.map(a=>[a,false]))]));
const VS={Pastor:"Pastor Visit",TeamLeader:"Team Leader",Sponsor:"Sponsor",OngoingCare:"Ongoing Care",Complete:"Complete"};
const VC={Pastor:N,TeamLeader:PU,Sponsor:GR,OngoingCare:G,Complete:TE};
const METH_IC={Text:"💬",Call:"📞",Visit:"🚪"};
const METH_CLR={Text:{bg:"#f3e8ff",c:PU},Call:{bg:"#eff6ff",c:BL},Visit:{bg:"#dcfce7",c:GR}};
const AVC=["#1a2e5a","#c9a84c","#2e7d32","#1565c0","#6a1b9a","#00695c","#c62828","#e65100"];
const avc=s=>{let x=0;for(let c of(s||""))x+=c.charCodeAt(0);return AVC[x%AVC.length];};
const ini=(f,l)=>((f||"")[0]+(l||"")[0]).toUpperCase();
const f$=n=>"$"+Number(n).toLocaleString();
const fd=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const td=()=>new Date().toISOString().split("T")[0];
const albl=a=>({view:"View",create:"Create",edit:"Edit",delete:"Delete"}[a]||a);
const actionColor=a=>({view:BL,create:GR,edit:"#d97706",delete:RE}[a]||MU);

// RBAC: Resolve effective permission for a user on a module+action
// Checks user-level overrides first, then falls back to their role.
function checkPermission(user, roles, permissions, moduleKey, action) {
  if(!user) return false;
  if(user.superAdmin) return true;
  // Check user-level override first (null = no override, true/false = explicit)
  if(user.overrides && user.overrides[moduleKey] && user.overrides[moduleKey][action] !== undefined && user.overrides[moduleKey][action] !== null) {
    return user.overrides[moduleKey][action];
  }
  // Fall back to role
  if(!user.roleId) return false;
  const rolePerms = permissions[user.roleId];
  if(!rolePerms) return false;
  return !!(rolePerms[moduleKey] && rolePerms[moduleKey][action]);
}

function effectivePermissions(user, roles, permissions) {
  if(!user) return {};
  if(user.superAdmin) {
    const full = {};
    MODULES.forEach(m => { full[m.key] = {}; m.actions.forEach(a => full[m.key][a] = true); });
    return full;
  }
  const result = {};
  const base = permissions[user.roleId] || {};
  MODULES.forEach(m => {
    result[m.key] = {};
    m.actions.forEach(a => {
      const override = user.overrides && user.overrides[m.key] && user.overrides[m.key][a];
      if(override !== undefined && override !== null) result[m.key][a] = override;
      else result[m.key][a] = !!(base[m.key] && base[m.key][a]);
    });
  });
  return result;
}
const BDGE={
  Member:{bg:"#e8f5e9",c:"#1b5e20"},Active:{bg:"#e8f5e9",c:"#1b5e20"},
  "First Visit":{bg:"#fff3e0",c:"#bf360c"},"Follow-Up Needed":{bg:"#fce4ec",c:"#880e4f"},
  Returning:{bg:"#e3f2fd",c:"#0d47a1"},Prospect:{bg:"#f3e5f5",c:"#4a148c"},
  Inactive:{bg:"#f5f5f5",c:"#616161"},Answered:{bg:"#e8f5e9",c:"#1b5e20"},
};

// ── ElevenLabs TTS ──
async function speakEL(text, voiceId) {
  if (!text || !voiceId || !_elAudio) return false;
  const clean = text.replace(/\*\*|__|##|#|\[[\s\S]*?\]/g,"").replace(/\n+/g," ").substring(0,600);
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
      method:"POST",
      headers:{"Accept":"audio/mpeg","Content-Type":"application/json","xi-api-key":EL_KEY},
      body:JSON.stringify({text:clean,model_id:"eleven_turbo_v2_5",voice_settings:{stability:0.5,similarity_boost:0.75,use_speaker_boost:true}})
    });
    if (!res.ok) {
      const errBody = await res.text().catch(()=>"");
      throw new Error("ElevenLabs " + res.status + (errBody?" — "+errBody.substring(0,120):""));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _elAudio.pause();
    try { URL.revokeObjectURL(_elAudio.src); } catch(e) {}
    _elAudio.src = url;
    await _elAudio.play();
    return true;
  } catch(e) {
    console.error("ElevenLabs TTS error:", e);
    return false;
  }
}

// ── AI ──
function buildSys(members, visitors, attend, giving, prayers, mem) {
  const aprilGiving = giving.filter(g=>g.date.startsWith("2026-04")).reduce((a,g)=>a+g.amount,0);
  const recentAttend = attend.slice(0,12).map(a=>({date:a.date,service:a.service,count:a.count}));
  const recentGiving = giving.slice(0,20).map(g=>({date:g.date,name:g.name,category:g.category,amount:g.amount,method:g.method}));
  const recentPrayers = prayers.slice(0,15).map(p=>({name:p.name||"",request:p.request||"",status:p.status||""}));
  return "You are "+(window.__CS__?.name||"NTCC")+" AI — an intelligence at IQ 250, combining Elon Musk's first-principles brilliance, Nikola Tesla's inventive genius, and a warm Southern American pastor's heart. You serve "+(window.__CS__?.pastorName||"Pastor Hall")+" of "+(window.__CS__?.name||"New Testament Christian Church")+", "+(window.__CS__?.address||"Glendale AZ")+". Call them "+(window.__CS__?.pastorName||"Pastor Hall")+" or Sir. Speak warmly and naturally.\n\n" +
    "LIVE DATABASE:\n" +
    "Members(" + members.length + "): " + JSON.stringify(members.slice(0,60).map(m=>({id:m.id,name:m.first+" "+m.last,status:m.status,role:m.role,phone:m.phone,email:m.email}))) + "\n" +
    "Visitors(" + visitors.length + "): " + JSON.stringify(visitors.slice(0,30).map(v=>({id:v.id,name:v.first+" "+v.last,stage:v.stage,phone:v.phone,firstVisit:v.firstVisit}))) + "\n" +
    "Attendance(" + attend.length + " records, recent 12): " + JSON.stringify(recentAttend) + "\n" +
    "April Giving: $" + aprilGiving + " | Recent Giving: " + JSON.stringify(recentGiving) + "\n" +
    "Prayer Requests (recent 15): " + JSON.stringify(recentPrayers) + "\n\n" +
    "MEMORY: " + (mem.preferences||"Learning...") + " | Commands: " + (mem.commands||"Building...") + "\n\n" +
    "COMMAND EXECUTION: When Pastor Hall gives an executable command, respond naturally first, then on its own line append:\n" +
    "[ACTION:{\"type\":\"TYPE\",\"data\":{},\"confirm\":\"Plain English confirmation\"}]\n\n" +
    "Types: ADD_MEMBER(first,last,phone,email,role,status,joined) | ADD_VISITOR(first,last,phone,email,stage,firstVisit,notes) | LOG_ATTENDANCE(date,service,count,members,visitors,notes) | RECORD_GIVING(name,date,category,amount,method,notes) | UPDATE_MEMBER(id,status,role) | DELETE_MEMBER(id) | DELETE_VISITOR(id) | NAVIGATE(section)\n\n" +
    "Sections: people, visitation, attendance, giving, prayer, access\n\n" +
    "Only append [ACTION:...] for clear executable commands. For analysis or conversation respond naturally only.";
}

async function callAI(messages, members, visitors, attend, giving, prayers, mem) {
  const AI_KEY = localStorage.getItem("ntcc_ai_api_key") || "";
  if (!AI_KEY) throw new Error("No API key");
  const systemPrompt = typeof messages === "string"
    ? "You are NTCC AI, a helpful church assistant for Pastor Hall."
    : buildSys(members, visitors, attend, giving, prayers, mem);
  const msgList = typeof messages === "string"
    ? [{role:"user", content:messages}]
    : messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => !String(m.content).startsWith("Error:"))
        .map(m => ({role:m.role, content:m.content}));
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({messages: msgList, system: systemPrompt, apiKey: AI_KEY})
  });
  const text = await res.text();
  let d: any;
  try { d = JSON.parse(text); } catch(e) {
    throw new Error("AI API returned unexpected response (status " + res.status + "). The /api/ai function may not be deployed — check Vercel Functions tab.");
  }
  if (!res.ok) {
    throw new Error("AI API " + res.status + (d?.error ? " — " + d.error : ""));
  }
  return d.content?.find((c:any) => c.type === "text")?.text || "I do apologize, Pastor Hall — something went wrong. Please try again, Sir.";
}

function parseAction(text) {
  const m = text.match(/\[ACTION:(\{[\s\S]*?\})\]/);
  if (!m) return {clean:text, action:null};
  try {
    const action = JSON.parse(m[1]);
    const clean = text.replace(/\[ACTION:[\s\S]*?\]/, "").trim();
    return {clean, action};
  } catch(e) {
    return {clean:text, action:null};
  }
}

// ── SHARED UI ──
function Av({f,l,sz=32}) {
  const c = avc((f||"")+(l||""));
  return <div style={{width:sz,height:sz,borderRadius:"50%",background:c+"22",color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.38,fontWeight:500,flexShrink:0}}>{ini(f,l)}</div>;
}

function Btn({children,onClick,v="primary",style={},disabled=false}) {
  const vs = {
    primary:{background:N,color:"#fff",border:"none"},
    gold:{background:G,color:"#fff",border:"none"},
    ghost:{background:"transparent",color:TX,border:"0.5px solid "+BR},
    ai:{background:N+"14",color:N,border:"0.5px solid "+N},
    danger:{background:"#fee2e2",color:RE,border:"0.5px solid #fca5a5"},
    success:{background:"#dcfce7",color:GR,border:"0.5px solid #86efac"},
    outline:{background:"transparent",color:N,border:"0.5px solid "+N},
  };
  return (
    <button onClick={disabled?undefined:onClick} style={{padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:500,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",...(vs[v]||vs.primary),...style}}>
      {children}
    </button>
  );
}

function Modal({open,onClose,title,children,width=480}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000055",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:W,borderRadius:12,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",padding:24,boxSizing:"border-box",border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{fontSize:16,fontWeight:500,color:N,margin:0}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:MU,lineHeight:1}}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Fld({label,children}) {
  return <div style={{marginBottom:12}}><div style={{fontSize:12,color:MU,marginBottom:4}}>{label}</div>{children}</div>;
}

function Inp({value,onChange,type="text",placeholder=""}) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>;
}

function Slt({value,onChange,opts}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>{opts.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select>;
}

function Stat({label,value,sub,color}) {
  return (
    <div style={{background:W,border:"0.5px solid "+BR,borderRadius:10,padding:"14px 16px",flex:1,minWidth:0}}>
      <div style={{fontSize:11,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:24,fontWeight:500,color:color||N}}>{value}</div>
      {sub && <div style={{fontSize:11,color:MU,marginTop:2}}>{sub}</div>}
    </div>
  );
}

function Badge({label}) {
  const s = BDGE[label] || {bg:"#f5f5f5",c:"#616161"};
  return <span style={{background:s.bg,color:s.c,display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:500}}>{label}</span>;
}

function PINInput({value,onChange}) {
  return (
    <div style={{display:"flex",gap:8}}>
      {[0,1,2,3].map(i=>(
        <input key={i} type="password" maxLength={1} value={(value||"")[i]||""}
          onChange={e=>{
            const d=(value||"    ").split("");
            d[i]=e.target.value.replace(/\D/,"");
            onChange(d.join("").trim());
            if(e.target.value&&e.target.nextSibling) e.target.nextSibling.focus();
          }}
          style={{width:44,height:44,textAlign:"center",fontSize:20,border:"0.5px solid "+BR,borderRadius:8,outline:"none",fontFamily:"monospace"}}
        />
      ))}
    </div>
  );
}

// ── ACCESS CONTROL — Full RBAC System ──
const SEED_ROLES=[
  {id:"role_admin",name:"Administrator",description:"Full system access",color:"#dc2626",isSystem:true},
  {id:"role_pastor",name:"Pastor",description:"Pastoral oversight and reports",color:"#1a2e5a",isSystem:false},
  {id:"role_staff",name:"Staff",description:"Day-to-day operations",color:"#2563eb",isSystem:false},
  {id:"role_volunteer",name:"Volunteer",description:"Limited task-specific access",color:"#16a34a",isSystem:false},
  {id:"role_team_leader",name:"Team Leader",description:"Leads a ministry team or small group",color:"#7c3aed",isSystem:false},
  {id:"role_sponsor",name:"Sponsor",description:"Mentors and sponsors new visitors",color:"#0891b2",isSystem:false},
  {id:"role_helper",name:"Helper",description:"General ministry helper",color:"#d97706",isSystem:false},
  {id:"role_musician",name:"Musician",description:"Worship team musician",color:"#be185d",isSystem:false},
  {id:"role_usher",name:"Usher",description:"Door and seating ministry",color:"#065f46",isSystem:false},
  {id:"role_checkin",name:"Check-in",description:"Kids and event check-in station",color:"#ea580c",isSystem:false},
  {id:"role_kitchen",name:"Kitchen",description:"Kitchen and hospitality ministry",color:"#854d0e",isSystem:false},
  {id:"role_nursery",name:"Nursery",description:"Nursery care team",color:"#4f46e5",isSystem:false},
];
const makeFullPerms=()=>{const p={};MODULES.forEach(m=>{p[m.key]={};m.actions.forEach(a=>p[m.key][a]=true);});return p;};
const makeEmptyPerms=()=>{const p={};MODULES.forEach(m=>{p[m.key]={};m.actions.forEach(a=>p[m.key][a]=false);});return p;};
const SEED_PERMS={
  role_admin: makeFullPerms(),
  role_pastor: (()=>{const p=makeFullPerms();p.settings={view:true,create:false,edit:false,delete:false};return p;})(),
  role_staff: (()=>{const p=makeEmptyPerms();["directory","visitation","groups","education","events","attendance","giving","prayer","reports","media"].forEach(k=>{p[k]={view:true,create:true,edit:true,delete:false};});return p;})(),
  role_volunteer: (()=>{const p=makeEmptyPerms();["directory","events","attendance","prayer"].forEach(k=>{p[k]={view:true,create:false,edit:false,delete:false};});p.education={view:true,create:true,edit:false,delete:false};return p;})(),
  role_team_leader: makeEmptyPerms(),
  role_sponsor: makeEmptyPerms(),
  role_helper: makeEmptyPerms(),
  role_musician: makeEmptyPerms(),
  role_usher: makeEmptyPerms(),
  role_checkin: makeEmptyPerms(),
  role_kitchen: makeEmptyPerms(),
  role_nursery: makeEmptyPerms(),
};

// Toggle Switch
function Toggle({on,onChange,size="md",color=GR,disabled=false}){
  const w = size==="sm"?32:40;
  const h = size==="sm"?18:22;
  const dotSize = size==="sm"?12:16;
  return (
    <div onClick={()=>!disabled&&onChange(!on)} style={{width:w,height:h,borderRadius:h/2,background:on?color:BR,position:"relative",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"background 0.15s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?w-dotSize-3:3,width:dotSize,height:dotSize,borderRadius:"50%",background:"#fff",transition:"left 0.15s",boxShadow:"0 1px 3px #00000033"}}></div>
    </div>
  );
}

// Users Tab
function UsersTab({members,users,setUsers,roles,permissions,currentUser}){
  const [search,setSearch] = useState("");
  const [filterRole,setFilterRole] = useState("all");
  const [filterStatus,setFilterStatus] = useState("all");
  const [modal,setModal] = useState(false);
  const [editU,setEditU] = useState(null);
  const [form,setForm] = useState({memberId:"",roleId:"",password:"",pin:"",status:"Pending"});
  const [detailU,setDetailU] = useState(null);
  const [overrideModal,setOverrideModal] = useState(null);
  const [confirmModal,setConfirmModal] = useState(null);
  const nid = useRef(300);

  const isAdmin = currentUser?.superAdmin || (currentUser?.roleId && roles.find(r=>r.id===currentUser.roleId)?.name==="Administrator");
  const used = users.filter(u=>u.id!==editU?.id).map(u=>u.memberId);
  const avail = members.filter(m=>!used.includes(m.id));
  const memberOf = uid => { const u=users.find(x=>x.id===uid); return u?members.find(m=>m.id===u.memberId):null; };

  const filtered = users.filter(u=>{
    const m = memberOf(u.id);
    if(!m) return false;
    if(search && !(m.first+" "+m.last+" "+(m.email||"")).toLowerCase().includes(search.toLowerCase())) return false;
    if(filterRole!=="all" && u.roleId!==filterRole && !(filterRole==="super"&&u.superAdmin)) return false;
    if(filterStatus!=="all" && u.status!==filterStatus) return false;
    return true;
  });

  const openAdd = () => {
    if(!isAdmin) { alert("Only administrators can add users."); return; }
    setEditU(null); setForm({memberId:"",roleId:"",password:"",pin:"",status:"Pending"}); setModal(true);
  };
  const openEdit = u => {
    if(!isAdmin) { alert("Only administrators can edit users."); return; }
    setEditU(u); setForm({memberId:u.memberId,roleId:u.roleId||"",password:u.password,pin:u.pin,status:u.status}); setModal(true);
  };
  const save = () => {
    if(!form.memberId||!form.roleId||!form.password||form.pin.length<4){alert("All fields required. PIN must be 4 digits.");return;}
    if(editU) setUsers(us=>us.map(u=>u.id===editU.id?{...u,...form,memberId:+form.memberId}:u));
    else setUsers(us=>[...us,{...form,memberId:+form.memberId,id:nid.current++,overrides:{}}]);
    setModal(false);
  };
  const doAction = (id,action) => {
    if(!isAdmin){alert("Only administrators can change user status.");return;}
    const u = users.find(x=>x.id===id);
    const actions = {
      approve:{status:"Active",label:"Approve",msg:"Approve this user and grant access?"},
      suspend:{status:"Suspended",label:"Suspend",msg:"Suspend this user? They will be locked out."},
      reactivate:{status:"Active",label:"Reactivate",msg:"Reactivate this user?"},
      remove:{status:null,label:"Remove",msg:"Permanently remove this user? This cannot be undone."}
    };
    const a = actions[action];
    setConfirmModal({
      title: a.label + " User",
      message: a.msg,
      confirmLabel: a.label,
      danger: action==="remove"||action==="suspend",
      onConfirm: () => {
        if(action==="remove") setUsers(us=>us.filter(x=>x.id!==id));
        else setUsers(us=>us.map(x=>x.id===id?{...x,status:a.status}:x));
        setConfirmModal(null);
        if(detailU?.id===id && action==="remove") setDetailU(null);
      }
    });
  };

  const statusColors = {Active:{bg:"#dcfce7",c:GR},Pending:{bg:"#fef9c3",c:"#854d0e"},Suspended:{bg:"#fee2e2",c:RE}};
  const activeCount = users.filter(u=>u.status==="Active").length;
  const pendingCount = users.filter(u=>u.status==="Pending").length;
  const suspendedCount = users.filter(u=>u.status==="Suspended").length;

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Stat label="Total Users" value={users.length} color={N}/>
        <Stat label="Active" value={activeCount} color={GR}/>
        <Stat label="Pending Approval" value={pendingCount} color={AM}/>
        <Stat label="Suspended" value={suspendedCount} color={RE}/>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users by name or email..." style={{flex:1,minWidth:240,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
          <option value="all">All Roles</option>
          <option value="super">Super Admin</option>
          {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Suspended">Suspended</option>
        </select>
        <Btn onClick={openAdd} disabled={!isAdmin}>+ Add User</Btn>
      </div>

      {!isAdmin && <div style={{background:"#fef9c3",border:"0.5px solid "+AM+"66",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#713f12"}}><strong>Read-only mode.</strong> Only administrators can add or modify users.</div>}

      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        {filtered.length===0 ? (
          <div style={{padding:48,textAlign:"center",color:MU,fontSize:13}}>{users.length===0?"No users yet. Click + Add User to begin.":"No users match your filters."}</div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#f8f9fc"}}>
                {["User","Email","Role","Status","Overrides",""].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u=>{
                const m = memberOf(u.id);
                const r = roles.find(x=>x.id===u.roleId);
                const s = statusColors[u.status]||{bg:BG,c:MU};
                const overrideCount = u.overrides ? Object.values(u.overrides).reduce((a,mod)=>a+Object.values(mod||{}).filter(v=>v!==undefined&&v!==null).length,0) : 0;
                return (
                  <tr key={u.id} onClick={()=>setDetailU(u)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f8f9fc"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                    <td style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Av f={m.first} l={m.last} sz={34}/>
                        <div><div style={{fontSize:13,fontWeight:500,color:N}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{m.role||"Member"}</div></div>
                      </div>
                    </td>
                    <td style={{padding:"11px 14px",fontSize:12,color:MU}}>{m.email||"—"}</td>
                    <td style={{padding:"11px 14px"}}>
                      {u.superAdmin ? <span style={{background:"#fef2f2",color:RE,border:"0.5px solid "+RE+"44",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>Super Admin</span>
                      : r ? <span style={{background:r.color+"18",color:r.color,border:"0.5px solid "+r.color+"44",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{r.name}</span>
                      : <span style={{color:MU,fontSize:11}}>No role</span>}
                    </td>
                    <td style={{padding:"11px 14px"}}><span style={{background:s.bg,color:s.c,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{u.status}</span></td>
                    <td style={{padding:"11px 14px",fontSize:12}}>{overrideCount>0 ? <span style={{background:"#eff6ff",color:BL,borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:500}}>{overrideCount} custom</span> : <span style={{color:MU}}>—</span>}</td>
                    <td style={{padding:"11px 14px"}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                        {u.status==="Pending" && isAdmin && <Btn onClick={()=>doAction(u.id,"approve")} v="success" style={{fontSize:11,padding:"4px 9px"}}>Approve</Btn>}
                        {u.status==="Active" && isAdmin && !u.superAdmin && <Btn onClick={()=>doAction(u.id,"suspend")} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>Suspend</Btn>}
                        {u.status==="Suspended" && isAdmin && <Btn onClick={()=>doAction(u.id,"reactivate")} v="outline" style={{fontSize:11,padding:"4px 9px"}}>Reactivate</Btn>}
                        {isAdmin && <Btn onClick={()=>openEdit(u)} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>Edit</Btn>}
                        {isAdmin && !u.superAdmin && <Btn onClick={()=>doAction(u.id,"remove")} v="danger" style={{fontSize:11,padding:"4px 9px"}}>X</Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editU?"Edit User":"Add System User"}>
        <Fld label="Select Member *">
          <select value={form.memberId} onChange={e=>setForm(f=>({...f,memberId:+e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            <option value="">Select a member</option>
            {(editU?members:avail).map(m=><option key={m.id} value={m.id}>{m.first} {m.last}{m.role?" ("+m.role+")":""}</option>)}
          </select>
        </Fld>
        <Fld label="Assign Role *">
          <select value={form.roleId} onChange={e=>setForm(f=>({...f,roleId:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            <option value="">Select a role</option>
            {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Password *"><Inp type="password" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} placeholder="Create a password"/></Fld>
          <Fld label="4-Digit PIN *"><PINInput value={form.pin} onChange={v=>setForm(f=>({...f,pin:v}))}/></Fld>
        </div>
        <Fld label="Status">
          <div style={{display:"flex",gap:8}}>
            {["Pending","Active","Suspended"].map(s=>(
              <button key={s} onClick={()=>setForm(f=>({...f,status:s}))} style={{padding:"7px 14px",borderRadius:8,fontSize:12,cursor:"pointer",border:"0.5px solid "+(form.status===s?N:BR),background:form.status===s?N:W,color:form.status===s?"#fff":TX,fontWeight:form.status===s?500:400}}>{s}</button>
            ))}
          </div>
        </Fld>
        <div style={{display:"flex",gap:8,marginTop:6}}>
          <Btn onClick={save} style={{flex:1,justifyContent:"center"}}>{editU?"Save Changes":"Create User"}</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>

      {/* User Detail Modal with permission overview */}
      <Modal open={!!detailU} onClose={()=>setDetailU(null)} title="" width={620}>
        {detailU && (()=>{
          const m = memberOf(detailU.id);
          const r = roles.find(x=>x.id===detailU.roleId);
          const eff = effectivePermissions(detailU, roles, permissions);
          const rolePerms = permissions[detailU.roleId] || {};
          return (
            <div style={{marginTop:-14}}>
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0 16px",borderBottom:"0.5px solid "+BR,marginBottom:16}}>
                <Av f={m.first} l={m.last} sz={54}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:500,color:N}}>{m.first} {m.last}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
                    {detailU.superAdmin ? <span style={{background:"#fef2f2",color:RE,border:"0.5px solid "+RE+"44",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>Super Admin</span>
                    : r ? <span style={{background:r.color+"18",color:r.color,border:"0.5px solid "+r.color+"44",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{r.name}</span> : null}
                    <span style={{background:(statusColors[detailU.status]||{bg:BG}).bg,color:(statusColors[detailU.status]||{c:MU}).c,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{detailU.status}</span>
                  </div>
                  <div style={{fontSize:12,color:MU,marginTop:3}}>{m.email||"—"}</div>
                </div>
                {isAdmin && !detailU.superAdmin && (
                  <Btn onClick={()=>setOverrideModal(detailU)} v="gold" style={{fontSize:12}}>Override Permissions</Btn>
                )}
              </div>

              <div style={{marginBottom:10,fontSize:12,color:MU,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:600,color:N}}>Effective Permissions</span>
                <div style={{display:"flex",gap:8,fontSize:10}}>
                  <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:GR,borderRadius:2}}></div>Role</span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:G,borderRadius:2}}></div>Override</span>
                </div>
              </div>

              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f8f9fc"}}><th style={{padding:"9px 12px",textAlign:"left",fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>Module</th>{["View","Create","Edit","Delete"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:"center",fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {MODULES.map(mod=>{
                      return (
                        <tr key={mod.key} style={{borderBottom:"0.5px solid "+BR}}>
                          <td style={{padding:"8px 12px",fontSize:12,fontWeight:500}}>{mod.label}</td>
                          {mod.actions.map(a=>{
                            const isOn = eff[mod.key]?.[a];
                            const isOverride = detailU.overrides && detailU.overrides[mod.key] && detailU.overrides[mod.key][a] !== undefined && detailU.overrides[mod.key][a] !== null;
                            const roleHad = !!(rolePerms[mod.key] && rolePerms[mod.key][a]);
                            return (
                              <td key={a} style={{padding:"8px 10px",textAlign:"center"}}>
                                {isOn ? <span style={{display:"inline-block",width:18,height:18,borderRadius:4,background:isOverride?G:GR,color:"#fff",fontSize:11,lineHeight:"18px",fontWeight:700}}>v</span>
                                : <span style={{display:"inline-block",width:18,height:18,borderRadius:4,border:"1px solid "+BR,background:isOverride?"#fff5f5":"transparent"}}></span>}
                                {isOverride && roleHad!==isOn && <div style={{fontSize:8,color:G,marginTop:1}}>override</div>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Override Modal */}
      {overrideModal && (
        <OverrideModal user={overrideModal} onClose={()=>setOverrideModal(null)} roles={roles} permissions={permissions} setUsers={setUsers} memberOf={memberOf}/>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <Modal open={true} onClose={()=>setConfirmModal(null)} title={confirmModal.title} width={400}>
          <p style={{fontSize:13,color:TX,lineHeight:1.6,marginBottom:16}}>{confirmModal.message}</p>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={confirmModal.onConfirm} v={confirmModal.danger?"danger":"primary"} style={{flex:1,justifyContent:"center"}}>{confirmModal.confirmLabel}</Btn>
            <Btn onClick={()=>setConfirmModal(null)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OverrideModal({user,onClose,roles,permissions,setUsers,memberOf}){
  const m = memberOf(user.id);
  const r = roles.find(x=>x.id===user.roleId);
  const rolePerms = permissions[user.roleId] || {};
  const [overrides,setOverrides] = useState(user.overrides||{});

  const getCurrent = (mod,act) => {
    const ov = overrides[mod]?.[act];
    if(ov !== undefined && ov !== null) return ov;
    return !!(rolePerms[mod] && rolePerms[mod][act]);
  };
  const hasOverride = (mod,act) => {
    const ov = overrides[mod]?.[act];
    return ov !== undefined && ov !== null;
  };
  const setOverride = (mod,act,val) => {
    setOverrides(o=>{const n={...o,[mod]:{...(o[mod]||{}),[act]:val}};return n;});
  };
  const clearOverride = (mod,act) => {
    setOverrides(o=>{const modP={...(o[mod]||{})};delete modP[act];const n={...o,[mod]:modP};if(Object.keys(modP).length===0)delete n[mod];return n;});
  };
  const save = () => {
    setUsers(us=>us.map(u=>u.id===user.id?{...u,overrides}:u));
    onClose();
  };
  const clearAll = () => { if(confirm("Clear all overrides and revert to role defaults?")) setOverrides({}); };

  const overrideCount = Object.values(overrides).reduce((a,mod)=>a+Object.values(mod||{}).filter(v=>v!==undefined&&v!==null).length,0);

  return (
    <Modal open={true} onClose={onClose} title="" width={700}>
      <div style={{marginTop:-14}}>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0 16px",borderBottom:"0.5px solid "+BR,marginBottom:14}}>
          <Av f={m.first} l={m.last} sz={44}/>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:500,color:N}}>Override Permissions: {m.first} {m.last}</div>
            {r && <div style={{fontSize:12,color:MU,marginTop:2}}>Base role: <span style={{color:r.color,fontWeight:500}}>{r.name}</span> · {overrideCount} override{overrideCount!==1?"s":""} active</div>}
          </div>
        </div>

        <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:11,color:BL,lineHeight:1.6}}>
          <strong>How overrides work:</strong> Toggle an action ON to explicitly grant access beyond the role. Toggle OFF to explicitly deny access the role would give. Click "Reset" on any row to revert to the role default.
        </div>

        <div style={{maxHeight:440,overflowY:"auto",border:"0.5px solid "+BR,borderRadius:10}}>
          {MODULES.map((mod,i)=>(
            <div key={mod.key} style={{borderBottom:i<MODULES.length-1?"0.5px solid "+BR:"none",padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:N}}>{mod.label}</div>
                  <div style={{fontSize:11,color:MU}}>{mod.desc}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {mod.actions.map(a=>{
                  const current = getCurrent(mod.key,a);
                  const isOver = hasOverride(mod.key,a);
                  const roleVal = !!(rolePerms[mod.key] && rolePerms[mod.key][a]);
                  return (
                    <div key={a} style={{flex:"1 1 0",minWidth:130,padding:"8px 10px",background:isOver?(current?"#f0fdf4":"#fff5f5"):BG,borderRadius:7,border:"0.5px solid "+(isOver?(current?GR+"66":RE+"66"):BR)}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:500,color:actionColor(a)}}>{albl(a)}</span>
                        <Toggle on={current} onChange={v=>setOverride(mod.key,a,v)} size="sm" color={isOver?G:GR}/>
                      </div>
                      <div style={{fontSize:9,color:MU,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span>Role: {roleVal?"Yes":"No"}</span>
                        {isOver && <button onClick={()=>clearOverride(mod.key,a)} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:G,textDecoration:"underline",padding:0}}>Reset</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:8,marginTop:14}}>
          <Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save Overrides ({overrideCount})</Btn>
          <Btn onClick={clearAll} v="ghost">Clear All</Btn>
          <Btn onClick={onClose} v="ghost">Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
}

// Roles Tab
function RolesTab({roles,setRoles,permissions,setPermissions,users,currentUser}){
  const [modal,setModal] = useState(false);
  const [editR,setEditR] = useState(null);
  const [form,setForm] = useState({name:"",description:"",color:ROLE_COLORS[0]});
  const nid = useRef(400);
  const isAdmin = currentUser?.superAdmin || (currentUser?.roleId && roles.find(r=>r.id===currentUser.roleId)?.name==="Administrator");

  const userCountForRole = roleId => users.filter(u=>u.roleId===roleId).length;
  const permCount = roleId => { const p=permissions[roleId]||{}; return Object.values(p).reduce((a,m)=>a+Object.values(m||{}).filter(Boolean).length,0); };
  const totalActions = MODULES.reduce((a,m)=>a+m.actions.length,0);

  const openAdd = () => { if(!isAdmin){alert("Admin required.");return;} setEditR(null); setForm({name:"",description:"",color:ROLE_COLORS[0]}); setModal(true); };
  const openEdit = r => { if(!isAdmin){alert("Admin required.");return;} setEditR(r); setForm({name:r.name,description:r.description,color:r.color}); setModal(true); };
  const save = () => {
    if(!form.name.trim()){alert("Role name required.");return;}
    if(editR) setRoles(rs=>rs.map(r=>r.id===editR.id?{...r,...form}:r));
    else { const id="role_"+nid.current++; setRoles(rs=>[...rs,{...form,id,isSystem:false}]); setPermissions(p=>({...p,[id]:makeEmptyPerms()})); }
    setModal(false);
  };
  const del = r => {
    if(r.isSystem){alert("System roles cannot be deleted.");return;}
    const count = userCountForRole(r.id);
    if(count>0){alert(count+" user(s) still have this role. Reassign them first.");return;}
    if(confirm("Delete role \""+r.name+"\"?")) {
      setRoles(rs=>rs.filter(x=>x.id!==r.id));
      setPermissions(p=>{ const n={...p}; delete n[r.id]; return n; });
    }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Roles ({roles.length})</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Role-Based Access Control — define once, assign to users</div>
        </div>
        <Btn onClick={openAdd} disabled={!isAdmin}>+ Create Role</Btn>
      </div>
      {!isAdmin && <div style={{background:"#fef9c3",border:"0.5px solid "+AM+"66",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#713f12"}}><strong>Read-only mode.</strong> Only administrators can create or modify roles.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {roles.map(r=>{
          const en = permCount(r.id);
          const uc = userCountForRole(r.id);
          return (
            <div key={r.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
              <div style={{background:r.color,padding:"12px 14px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>{r.name}</div>
                  {r.isSystem && <div style={{fontSize:10,opacity:0.85,marginTop:2}}>System Role</div>}
                </div>
                {isAdmin && !r.isSystem && (
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>openEdit(r)} style={{background:"#ffffff25",border:"none",borderRadius:5,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11}}>Edit</button>
                    <button onClick={()=>del(r)} style={{background:"#ffffff25",border:"none",borderRadius:5,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11}}>Del</button>
                  </div>
                )}
                {isAdmin && r.isSystem && <button onClick={()=>openEdit(r)} style={{background:"#ffffff25",border:"none",borderRadius:5,padding:"3px 8px",cursor:"pointer",color:"#fff",fontSize:11}}>Edit</button>}
              </div>
              <div style={{padding:14}}>
                {r.description && <div style={{fontSize:12,color:MU,marginBottom:10,lineHeight:1.5}}>{r.description}</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:11,color:MU}}>Permissions</span>
                  <span style={{fontSize:11,fontWeight:500,color:r.color}}>{en}/{totalActions}</span>
                </div>
                <div style={{height:5,background:BG,borderRadius:3,overflow:"hidden",marginBottom:10}}>
                  <div style={{width:Math.round(en/totalActions*100)+"%",height:"100%",background:r.color}}></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:MU,paddingTop:10,borderTop:"0.5px solid "+BR}}>
                  <span>{uc} user{uc!==1?"s":""} assigned</span>
                  <span>{MODULES.filter(m=>Object.values(permissions[r.id]?.[m.key]||{}).some(Boolean)).length} modules</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title={editR?"Edit Role":"Create New Role"} width={440}>
        <Fld label="Role Name *"><Inp value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Worship Leader, Youth Pastor..."/></Fld>
        <Fld label="Description"><Inp value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="Brief description..."/></Fld>
        <Fld label="Role Color">
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
            {ROLE_COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #1f2937":"3px solid transparent",boxSizing:"border-box"}}/>)}
          </div>
        </Fld>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:form.color+"14",borderRadius:8,marginBottom:14,border:"0.5px solid "+form.color+"44"}}>
          <div style={{width:12,height:12,borderRadius:"50%",background:form.color}}></div>
          <span style={{fontSize:13,fontWeight:500,color:form.color}}>{form.name||"Role Preview"}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1,justifyContent:"center"}}>Save Role</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// Permissions Matrix Tab
function PermTab({roles,permissions,setPermissions,currentUser}){
  const [sel,setSel] = useState(roles[0]?.id||null);
  const [saveBanner,setSaveBanner] = useState(false);
  const isAdmin = currentUser?.superAdmin || (currentUser?.roleId && roles.find(r=>r.id===currentUser.roleId)?.name==="Administrator");
  const role = roles.find(r=>r.id===sel);
  const perms = sel ? (permissions[sel]||makeEmptyPerms()) : null;

  const toggle = (mod,action) => {
    if(!isAdmin){alert("Admin required.");return;}
    const cur = permissions[sel]||makeEmptyPerms();
    setPermissions(p=>({...p,[sel]:{...cur,[mod]:{...cur[mod],[action]:!cur[mod]?.[action]}}}));
    setSaveBanner(true); setTimeout(()=>setSaveBanner(false),1500);
  };
  const toggleMod = (mod,val) => {
    if(!isAdmin){alert("Admin required.");return;}
    const cur = permissions[sel]||makeEmptyPerms();
    const def = MODULES.find(m=>m.key===mod);
    setPermissions(p=>({...p,[sel]:{...cur,[mod]:Object.fromEntries(def.actions.map(a=>[a,val]))}}));
  };
  const toggleAction = (action,val) => {
    if(!isAdmin){alert("Admin required.");return;}
    const cur = permissions[sel]||makeEmptyPerms();
    const next = {...cur};
    MODULES.forEach(m=>{if(m.actions.includes(action)){next[m.key]={...(next[m.key]||{}),[action]:val};}});
    setPermissions(p=>({...p,[sel]:next}));
  };
  const grantAll = () => { if(!isAdmin)return; if(role?.isSystem&&role.name==="Administrator"){alert("Administrator already has full access.");return;} if(confirm("Grant ALL permissions to "+role.name+"?")) setPermissions(p=>({...p,[sel]:makeFullPerms()})); };
  const revokeAll = () => { if(!isAdmin)return; if(role?.isSystem&&role.name==="Administrator"){alert("Administrator is always full access.");return;} if(confirm("Revoke ALL permissions from "+role.name+"?")) setPermissions(p=>({...p,[sel]:makeEmptyPerms()})); };

  if(roles.length===0) return <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU,fontSize:13}}>Create a role first.</div>;

  return (
    <div>
      {!isAdmin && <div style={{background:"#fef9c3",border:"0.5px solid "+AM+"66",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#713f12"}}><strong>Read-only mode.</strong> Only administrators can modify permissions.</div>}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,color:MU,marginBottom:8,fontWeight:500}}>Select a role to configure:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {roles.map(r=>(
            <button key={r.id} onClick={()=>setSel(r.id)} style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:sel===r.id?500:400,border:"1.5px solid "+(sel===r.id?r.color:BR),background:sel===r.id?r.color+"14":W,color:sel===r.id?r.color:TX,display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:r.color}}></div>{r.name}
            </button>
          ))}
        </div>
      </div>
      {sel && perms && role && (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:"0.5px solid "+BR,background:role.color+"08",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:role.color}}></div>
              <div>
                <div style={{fontSize:14,fontWeight:500,color:role.color}}>{role.name} Permissions Matrix</div>
                {role.isSystem && role.name==="Administrator" && <div style={{fontSize:11,color:MU}}>System role — always has full access</div>}
              </div>
              {saveBanner && <span style={{fontSize:11,background:GR,color:"#fff",borderRadius:10,padding:"2px 9px",fontWeight:500}}>Saved</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn onClick={grantAll} v="success" style={{fontSize:11,padding:"4px 10px"}} disabled={!isAdmin}>Grant All</Btn>
              <Btn onClick={revokeAll} v="danger" style={{fontSize:11,padding:"4px 10px"}} disabled={!isAdmin}>Revoke All</Btn>
            </div>
          </div>

          {/* Matrix header with column-level grant/revoke */}
          <div style={{display:"grid",gridTemplateColumns:"2fr repeat(4,1fr)",borderBottom:"1px solid "+BR,background:"#f8f9fc",padding:"10px 18px",alignItems:"center",gap:8}}>
            <div style={{fontSize:11,color:MU,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Module</div>
            {["view","create","edit","delete"].map(a=>(
              <div key={a} style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:actionColor(a),fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>{albl(a)}</div>
                <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                  <button onClick={()=>toggleAction(a,true)} style={{fontSize:9,color:GR,background:"none",border:"none",cursor:"pointer",padding:"1px 3px"}}>All</button>
                  <span style={{color:BR,fontSize:9}}>|</span>
                  <button onClick={()=>toggleAction(a,false)} style={{fontSize:9,color:RE,background:"none",border:"none",cursor:"pointer",padding:"1px 3px"}}>None</button>
                </div>
              </div>
            ))}
          </div>

          {MODULES.map((mod,i)=>{
            const mp = perms[mod.key]||{};
            const allOn = mod.actions.every(a=>mp[a]);
            const anyOn = mod.actions.some(a=>mp[a]);
            return (
              <div key={mod.key} style={{display:"grid",gridTemplateColumns:"2fr repeat(4,1fr)",borderBottom:i<MODULES.length-1?"0.5px solid "+BR:"none",padding:"12px 18px",alignItems:"center",gap:8}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <span style={{fontSize:13,fontWeight:500,color:N}}>{mod.label}</span>
                    {allOn && <span style={{fontSize:9,background:"#dcfce7",color:GR,borderRadius:3,padding:"1px 5px",fontWeight:500}}>FULL</span>}
                    {anyOn && !allOn && <span style={{fontSize:9,background:"#fef9c3",color:"#854d0e",borderRadius:3,padding:"1px 5px",fontWeight:500}}>PARTIAL</span>}
                  </div>
                  <div style={{fontSize:11,color:MU}}>{mod.desc}</div>
                  <div style={{display:"flex",gap:4,marginTop:3}}>
                    <button onClick={()=>toggleMod(mod.key,true)} style={{fontSize:9,color:GR,background:"none",border:"none",cursor:"pointer",padding:0}}>Grant all</button>
                    <span style={{color:BR,fontSize:9}}>·</span>
                    <button onClick={()=>toggleMod(mod.key,false)} style={{fontSize:9,color:RE,background:"none",border:"none",cursor:"pointer",padding:0}}>Revoke all</button>
                  </div>
                </div>
                {mod.actions.map(a=>{
                  const on = !!mp[a];
                  return (
                    <div key={a} style={{display:"flex",justifyContent:"center"}}>
                      <Toggle on={on} onChange={()=>toggle(mod.key,a)} color={actionColor(a)} disabled={!isAdmin}/>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PortalTab({members,portalMembers,setPortalMembers,currentUser,roles}){
  const [modal,setModal] = useState(false);
  const [sel,setSel] = useState(null);
  const [pin,setPin] = useState("");
  const [pinModal,setPinModal] = useState(false);
  const [editPin,setEditPin] = useState(null);
  const isAdmin = currentUser?.superAdmin || (currentUser?.roleId && roles?.find(r=>r.id===currentUser.roleId)?.name==="Administrator");
  const existing = portalMembers.map(p=>p.memberId);
  const avail = members.filter(m=>!existing.includes(m.id));

  const add = () => {
    if(!sel){alert("Select a member.");return;}
    if(pin.length<4){alert("PIN must be 4 digits.");return;}
    const newPerms = Object.fromEntries(PORTAL_PERMS.map(p=>[p.key,true]));
    setPortalMembers(ps=>[...ps,{memberId:sel.id,pin,status:"Active",perms:newPerms}]);
    setSel(null); setPin(""); setModal(false);
  };
  const togglePerm = (mid,key) => setPortalMembers(ps=>ps.map(p=>p.memberId===mid?{...p,perms:{...p.perms,[key]:!p.perms[key]}}:p));
  const toggleStatus = mid => setPortalMembers(ps=>ps.map(p=>p.memberId===mid?{...p,status:p.status==="Active"?"Suspended":"Active"}:p));
  const remove = mid => { if(confirm("Remove portal access?")) setPortalMembers(ps=>ps.filter(p=>p.memberId!==mid)); };

  return (
    <div>
      <div style={{background:GL,border:"0.5px solid "+G,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#7a5c10",lineHeight:1.7}}>
        <strong>Member Self-Service Portal</strong> — Selected members log in with a personal PIN to view their own records only (attendance, giving, events).
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Portal Members ({portalMembers.length})</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Separate from staff user accounts — members see only their own data</div>
        </div>
        <Btn onClick={()=>{setSel(null);setPin("");setModal(true);}} disabled={!isAdmin}>+ Grant Portal Access</Btn>
      </div>
      {portalMembers.length===0 ? (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
          <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>No portal access granted yet</h3>
          <p style={{fontSize:13,color:MU}}>Select members to give them access to their own personal information.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {portalMembers.map(pm=>{
            const m = members.find(x=>x.id===pm.memberId);
            if(!m) return null;
            const active = pm.status==="Active";
            return (
              <div key={pm.memberId} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <Av f={m.first} l={m.last} sz={40}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:500}}>{m.first} {m.last}</span>
                      <span style={{fontSize:11,borderRadius:20,padding:"2px 9px",fontWeight:500,background:active?"#dcfce7":"#fee2e2",color:active?GR:RE}}>{pm.status}</span>
                    </div>
                    <div style={{fontSize:12,color:MU,marginTop:2}}>{m.email} · {m.role||"Member"}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {isAdmin && <Btn onClick={()=>{setEditPin({memberId:pm.memberId,pin:""});setPinModal(true);}} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>Reset PIN</Btn>}
                    {isAdmin && <Btn onClick={()=>toggleStatus(pm.memberId)} v={active?"ghost":"outline"} style={{fontSize:11,padding:"4px 9px"}}>{active?"Suspend":"Reactivate"}</Btn>}
                    {isAdmin && <Btn onClick={()=>remove(pm.memberId)} v="danger" style={{fontSize:11,padding:"4px 9px"}}>X</Btn>}
                  </div>
                </div>
                <div style={{borderTop:"0.5px solid "+BR,paddingTop:10}}>
                  <div style={{fontSize:10,color:MU,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5,fontWeight:500}}>Portal Permissions</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {PORTAL_PERMS.map(pp=>{
                      const on = !!pm.perms[pp.key];
                      return (
                        <div key={pp.key} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:7,background:on?"#f0fdf4":BG,border:"0.5px solid "+(on?GR+"66":BR)}}>
                          <Toggle on={on} onChange={()=>isAdmin&&togglePerm(pm.memberId,pp.key)} size="sm" disabled={!isAdmin}/>
                          <span style={{fontSize:11,color:on?GR:TX,fontWeight:on?500:400}}>{pp.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Grant Member Portal Access" width={420}>
        <Fld label="Select Member *">
          <select value={sel?.id||""} onChange={e=>setSel(members.find(m=>m.id===+e.target.value)||null)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            <option value="">Choose a member</option>
            {avail.map(m=><option key={m.id} value={m.id}>{m.first} {m.last}{m.role?" ("+m.role+")":""}</option>)}
          </select>
        </Fld>
        <Fld label="Set 4-Digit Portal PIN *"><PINInput value={pin} onChange={setPin}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={add} style={{flex:1,justifyContent:"center"}}>Grant Access</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
      <Modal open={pinModal} onClose={()=>setPinModal(false)} title="Reset Portal PIN" width={360}>
        <Fld label="New 4-Digit PIN *"><PINInput value={editPin?.pin||""} onChange={v=>setEditPin(p=>({...p,pin:v}))}/></Fld>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={()=>{
            if((editPin?.pin||"").length<4){alert("PIN must be 4 digits.");return;}
            setPortalMembers(ps=>ps.map(p=>p.memberId===editPin.memberId?{...p,pin:editPin.pin}:p));
            setPinModal(false); setEditPin(null);
          }} style={{flex:1,justifyContent:"center"}}>Save PIN</Btn>
          <Btn onClick={()=>setPinModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function Access({members,users,setUsers,roles,setRoles,permissions,setPermissions,portalMembers,setPortalMembers,currentUser}) {
  const [tab,setTab] = useState("users");
  const pending = users.filter(u=>u.status==="Pending").length;
  const [visitors,setVisitors] = useState(window.__NTCC_INIT__?.visitors || IVISITORS);
  const [visitRecords,setVisitRecords] = useState([]);
  const fu = visitors.filter(v=>v.stage==="Follow-Up Needed").length;
  const inVis = visitRecords.filter(r=>r.stage!=="Complete").length;
  const [equipment,setEquipment] = useState(window.__NTCC_INIT__?.equipment || ISEED_EQUIP);
  const [workOrders,setWorkOrders] = useState(window.__NTCC_INIT__?.workOrders || ISEED_WO);
  const [schedMaint,setSchedMaint] = useState(window.__NTCC_INIT__?.schedMaint || ISEED_SCHED);
  const maintAlerts = computeMaintAlerts(equipment, schedMaint);
  const maintAlertCount = maintAlerts.overdue.length + maintAlerts.urgent.length + maintAlerts.warrantyExpired.length + maintAlerts.warrantyExpiringSoon.length;
  const isAdmin = currentUser?.superAdmin || (currentUser?.roleId && roles.find(r=>r.id===currentUser.roleId)?.name==="Administrator");
  const TABS=[{id:"users",label:"Users"},{id:"roles",label:"Roles"},{id:"permissions",label:"Permissions Matrix"},{id:"portal",label:"Member Portal"}];
  return (
    <div>
      <div style={{background:isAdmin?"#f0fdf4":"#fef9c3",border:"0.5px solid "+(isAdmin?GR+"55":AM+"55"),borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10,fontSize:12}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:isAdmin?GR:AM}}></div>
        <span style={{color:isAdmin?"#14532d":"#713f12"}}>
          Signed in as <strong>{currentUser?.superAdmin?"Super Administrator":roles.find(r=>r.id===currentUser?.roleId)?.name||"User"}</strong> — {isAdmin?"Full access to user and role management.":"Read-only access. Contact an administrator to make changes."}
        </span>
      </div>
      <div style={{display:"flex",marginBottom:20,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===t.id?G:"transparent"),background:tab===t.id?"#f8f9fc":W,fontSize:13,fontWeight:tab===t.id?500:400,color:tab===t.id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            {t.label}
            {t.id==="users" && pending>0 && <span style={{background:AM,color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px"}}>{pending}</span>}
            {t.id==="roles" && roles.length>0 && <span style={{background:N+"22",color:N,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{roles.length}</span>}
            {t.id==="portal" && portalMembers.length>0 && <span style={{background:GR+"22",color:GR,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{portalMembers.length}</span>}
          </button>
        ))}
      </div>
      {tab==="users" && <UsersTab members={members} users={users} setUsers={setUsers} roles={roles} permissions={permissions} currentUser={currentUser}/>}
      {tab==="roles" && <RolesTab roles={roles} setRoles={setRoles} permissions={permissions} setPermissions={setPermissions} users={users} currentUser={currentUser}/>}
      {tab==="permissions" && <PermTab roles={roles} permissions={permissions} setPermissions={setPermissions} currentUser={currentUser}/>}
      {tab==="portal" && <PortalTab members={members} portalMembers={portalMembers} setPortalMembers={setPortalMembers} currentUser={currentUser} roles={roles}/>}
    </div>
  );
}
// Helpers for ongoing care
function daysBetween(dateStr, refDate){
  const a = new Date(dateStr+"T00:00:00");
  const b = refDate ? new Date(refDate+"T00:00:00") : new Date();
  return Math.floor((b - a) / (1000*60*60*24));
}
function addDays(dateStr, n){
  const d = new Date(dateStr+"T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
// Compute next-due date for a record in OngoingCare
function getNextDue(rec){
  if(rec.stage!=="OngoingCare") return null;
  // Find the last contact logged during OngoingCare stage
  const careContacts = (rec.contacts||[]).filter(c=>c.stage==="OngoingCare");
  const lastDate = careContacts.length>0
    ? careContacts[careContacts.length-1].date
    : rec.ongoingStartDate || rec.completedDate || rec.createdDate;
  return addDays(lastDate, 14);
}
function careStatus(rec){
  if(rec.stage!=="OngoingCare") return null;
  const due = getNextDue(rec);
  const today = td();
  if(due < today) return {label:"Overdue",color:RE,bg:"#fee2e2",days:daysBetween(due,today)};
  if(due === today) return {label:"Due Today",color:AM,bg:"#fef9c3",days:0};
  const daysUntil = daysBetween(today,due);
  if(daysUntil <= 3) return {label:"Due Soon",color:AM,bg:"#fef9c3",days:daysUntil};
  return {label:"On Track",color:GR,bg:"#dcfce7",days:daysUntil};
}

// ── EMAIL SYSTEM ──
const EMAIL_CATEGORIES = ["General","Welcome","Follow-Up","Birthday","Anniversary","Pledge Receipt","Year-End Statement","Prayer Response","Announcement","Group Message","Pastoral Message","Custom"];

const DEFAULT_EMAIL_TEMPLATES = [
  {id:"tpl_welcome",name:"Welcome Letter",category:"Welcome",subject:"Welcome to {{church_name}}",body:"Dear {{first_name}},\n\nIt was a joy to have you with us at {{church_name}}! Thank you for visiting and worshiping with our church family.\n\nWe pray that you felt the presence of the Lord and the warmth of our fellowship. If there's anything we can do for you — whether it's a prayer need, a question about our church, or simply a conversation — please don't hesitate to reach out.\n\nWe would love to see you again soon. Our service times are:\n• Sunday Morning Worship — 11:00 AM\n• Sunday Evening Service — 6:00 PM\n• Tuesday Bible Study — 7:30 PM\n• Thursday Worship — 7:30 PM\n\nMay God richly bless you and your family.\n\nIn His Service,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_followup",name:"Visitor Follow-Up",category:"Follow-Up",subject:"Thinking of You, {{first_name}}",body:"Dear {{first_name}},\n\nI wanted to personally reach out and let you know how much we enjoyed having you at {{church_name}}. Your visit meant a great deal to us.\n\nI've been praying for you and your family. If there's anything specific we can be praying about, or if you have any questions about faith, our church, or life in general, I'm here.\n\nPlease know that you have a home here whenever you're ready.\n\nWith pastoral love,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_birthday",name:"Birthday Greeting",category:"Birthday",subject:"Happy Birthday, {{first_name}}!",body:"Dear {{first_name}},\n\nHappy birthday! On behalf of your {{church_name}} family, we want to celebrate this special day with you.\n\n\"This is the day which the Lord hath made; we will rejoice and be glad in it.\" — Psalm 118:24\n\nMay the Lord grant you a year filled with His grace, His presence, and His abundant blessings. You are loved, you are valued, and you are prayed for.\n\nWith joy and love,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_anniversary",name:"Anniversary Greeting",category:"Anniversary",subject:"Happy Anniversary!",body:"Dear {{first_name}},\n\nCongratulations on your anniversary! Marriage is one of God's most precious gifts, and we celebrate with you today.\n\n\"Therefore what God hath joined together, let not man put asunder.\" — Mark 10:9\n\nMay your home continue to be a place where Christ is honored, love grows deeper, and the Lord's presence is felt each and every day.\n\nWith blessings,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_receipt",name:"Pledge Receipt",category:"Pledge Receipt",subject:"Thank You for Your Gift to {{church_name}}",body:"Dear {{first_name}},\n\nThank you for your generous gift to {{church_name}}. Your faithfulness and obedience in giving is a testimony of your love for the Lord and His Kingdom.\n\nGIFT DETAILS\nDate: {{gift_date}}\nAmount: {{gift_amount}}\nCategory: {{gift_category}}\nMethod: {{gift_method}}\n\n\"Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.\" — 2 Corinthians 9:7\n\nPlease keep this receipt for your records. May the Lord bless you a hundredfold for your cheerful giving.\n\nIn His Service,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_yearend",name:"Year-End Statement",category:"Year-End Statement",subject:"{{year}} Giving Statement from {{church_name}}",body:"Dear {{first_name}},\n\nAs the year comes to a close, we want to express our deepest gratitude for your faithful giving to {{church_name}} this year.\n\n{{year}} TOTAL GIVING: {{total_given}}\nNumber of Gifts: {{gift_count}}\n\nYour generosity has made a real difference in the work of the Lord — in the lives touched, the ministries sustained, and the Gospel proclaimed. You are a partner in every soul reached and every life transformed.\n\n\"Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the Lord of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.\" — Malachi 3:10\n\nA detailed itemized statement is available upon request. Please keep this letter for your tax records. {{church_name}} is a recognized religious organization.\n\nWith deep gratitude,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_prayer",name:"Prayer Response",category:"Prayer Response",subject:"Praying With You",body:"Dear {{first_name}},\n\nI received your prayer request and want you to know that I am praying for you and your family. You are not alone — the Lord is with you, and your church family is standing with you.\n\n\"Cast thy burden upon the Lord, and he shall sustain thee: he shall never suffer the righteous to be moved.\" — Psalm 55:22\n\nIf you ever want to talk or need anything at all, please reach out.\n\nIn His love,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
  {id:"tpl_announcement",name:"Church Announcement",category:"Announcement",subject:"Important Announcement from {{church_name}}",body:"Dear {{first_name}},\n\n[Write your announcement here]\n\nWe look forward to seeing you soon!\n\nBlessings,\n{{pastor_name}}\n{{church_name}}",isDefault:true},
];

function renderTemplate(text, vars){
  if(!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (_,k) => vars[k] !== undefined ? vars[k] : "{{"+k+"}}");
}

function buildHtmlEmail(subject, body, cs){
  const bodyHtml = body.split("\n").map(line => line.trim() ? "<p style=\"margin:0 0 12px;font-size:14px;line-height:1.7;color:#1f2937\">"+line.replace(/\{([^}]*)\}/g,"&lbrace;$1&rbrace;")+"</p>" : "<br/>").join("");
  const logoHtml = cs?.logoUrl
    ? '<img src="'+cs.logoUrl+'" style="height:48px;margin-bottom:8px" alt="logo"/>'
    : '<div style="width:48px;height:48px;margin:0 auto 8px;background:#1a2e5a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#c9a84c;font-weight:700;font-size:14px;line-height:48px;text-align:center">'+((cs?.name||"CH").split(" ").filter(w=>w).slice(0,2).map(w=>w[0]).join("").toUpperCase())+'</div>';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head><body style="margin:0;padding:0;background:#f4f6fb;font-family:system-ui,-apple-system,sans-serif"><div style="max-width:600px;margin:0 auto;background:#fff"><div style="background:#1a2e5a;padding:24px;text-align:center;border-bottom:3px solid #c9a84c">${logoHtml}<div style="color:#fff;font-size:18px;font-weight:500;margin-top:4px">${cs?.name||"Church"}</div>${cs?.pastorName?'<div style="color:#c9a84c;font-size:12px;margin-top:2px">'+cs.pastorName+'</div>':""}</div><div style="padding:28px 24px">${bodyHtml}</div><div style="background:#f8f9fc;padding:16px 24px;border-top:0.5px solid #e2e5ec;text-align:center;font-size:11px;color:#6b7280">${cs?.name||""}${cs?.address?' · '+cs.address:""}${cs?.phone?' · '+cs.phone:""}${cs?.email?' · '+cs.email:""}</div></div></body></html>`;
}

function openMailto(to, subject, body, cc, bcc){
  const params = [];
  if(subject) params.push("subject="+encodeURIComponent(subject));
  if(body) params.push("body="+encodeURIComponent(body));
  if(cc) params.push("cc="+encodeURIComponent(cc));
  if(bcc) params.push("bcc="+encodeURIComponent(bcc));
  const url = "mailto:"+encodeURIComponent(to||"")+(params.length?"?"+params.join("&"):"");
  window.location.href = url;
}

async function sendDirectEmail(config, payload){
  if(!config || !config.provider || !config.apiKey){
    throw new Error("Email service not configured. Go to Settings → Email Service to set it up.");
  }
  throw new Error("Direct email sending requires API integration. Currently configured as '"+config.provider+"' but the service adapter needs to be wired up by a developer.");
}

// ── EMAIL CENTER PAGE ──
function EmailCenter({emailLog,setEmailLog,emailTemplates,setEmailTemplates,emailConfig,setEmailConfig,members,visitors,cs,onCompose,onBulkCompose}){
  const [tab,setTab] = useState("log");
  const [search,setSearch] = useState("");
  const [filterCat,setFilterCat] = useState("all");
  const [detail,setDetail] = useState(null);
  const [tplModal,setTplModal] = useState(false);
  const [editTpl,setEditTpl] = useState(null);
  const [tplForm,setTplForm] = useState({name:"",category:"Custom",subject:"",body:""});
  const [cfgSaved,setCfgSaved] = useState(false);
  const nid = useRef(7000);

  const filteredLog = emailLog.filter(e=>{
    if(search && !(e.subject+" "+(e.to||"")+" "+(e.toName||"")).toLowerCase().includes(search.toLowerCase())) return false;
    if(filterCat!=="all" && e.category!==filterCat) return false;
    return true;
  }).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));

  const stats = {
    total: emailLog.length,
    individual: emailLog.filter(e=>!e.isBulk).length,
    bulk: emailLog.filter(e=>e.isBulk).length,
    thisMonth: emailLog.filter(e=>e.timestamp.startsWith(new Date().toISOString().slice(0,7))).length,
  };

  const openAddTpl = ()=>{ setEditTpl(null); setTplForm({name:"",category:"Custom",subject:"",body:""}); setTplModal(true); };
  const openEditTpl = (tpl)=>{ setEditTpl(tpl); setTplForm({name:tpl.name,category:tpl.category,subject:tpl.subject,body:tpl.body}); setTplModal(true); };
  const saveTpl = () => {
    if(!tplForm.name||!tplForm.subject){alert("Name and subject required.");return;}
    if(editTpl) setEmailTemplates(ts=>ts.map(t=>t.id===editTpl.id?{...t,...tplForm}:t));
    else setEmailTemplates(ts=>[...ts,{...tplForm,id:"tpl_"+nid.current++,isDefault:false}]);
    setTplModal(false);
  };
  const delTpl = (tpl) => {
    if(tpl.isDefault){alert("Default templates cannot be deleted. Edit them instead.");return;}
    if(confirm("Delete this template?")) setEmailTemplates(ts=>ts.filter(t=>t.id!==tpl.id));
  };

  const saveCfg = () => {
    setEmailConfig(emailConfig);
    setCfgSaved(true);
    setTimeout(()=>setCfgSaved(false),2500);
  };

  const TABS = [{id:"log",label:"Email Log",count:emailLog.length},{id:"templates",label:"Templates",count:emailTemplates.length},{id:"service",label:"Email Service"}];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Email Center</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Compose, track, and template every email sent from this app</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onCompose} v="primary">+ Compose</Btn>
          <Btn onClick={onBulkCompose} v="gold">Bulk Email</Btn>
        </div>
      </div>

      <div style={{display:"flex",marginBottom:18,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===t.id?G:"transparent"),background:tab===t.id?"#f8f9fc":W,fontSize:13,fontWeight:tab===t.id?500:400,color:tab===t.id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {t.label}
            {t.count!==undefined && t.count>0 && <span style={{background:N+"22",color:N,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* LOG TAB */}
      {tab==="log" && (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <Stat label="Total Sent" value={stats.total}/>
            <Stat label="Individual" value={stats.individual} color={BL}/>
            <Stat label="Bulk" value={stats.bulk} color={G}/>
            <Stat label="This Month" value={stats.thisMonth} color={GR}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by subject, recipient..." style={{flex:1,minWidth:220,padding:"9px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"9px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
              <option value="all">All Categories</option>
              {EMAIL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {filteredLog.length===0 ? (
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
              <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>{emailLog.length===0?"No emails sent yet":"No emails match your filters"}</h3>
              <p style={{fontSize:13,color:MU,marginBottom:16}}>{emailLog.length===0?"Click Compose to send your first email.":"Try adjusting your search or filter."}</p>
              {emailLog.length===0 && <Btn onClick={onCompose}>+ Compose First Email</Btn>}
            </div>
          ) : (
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f8f9fc"}}>{["When","To","Subject","Category","Method","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredLog.map(e=>{
                    const dt = new Date(e.timestamp);
                    return (
                      <tr key={e.id} onClick={()=>setDetail(e)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={ev=>ev.currentTarget.style.background="#f8f9fc"} onMouseLeave={ev=>ev.currentTarget.style.background=W}>
                        <td style={{padding:"10px 14px",fontSize:12}}>
                          <div style={{fontWeight:500}}>{dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                          <div style={{fontSize:10,color:MU}}>{dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
                        </td>
                        <td style={{padding:"10px 14px",fontSize:13}}>
                          {e.isBulk ? (<div><div style={{fontWeight:500}}>{e.recipientCount} recipients</div><div style={{fontSize:10,color:MU}}>bulk send</div></div>) : (<div><div style={{fontWeight:500}}>{e.toName||e.to}</div>{e.toName && <div style={{fontSize:10,color:MU}}>{e.to}</div>}</div>)}
                        </td>
                        <td style={{padding:"10px 14px",fontSize:13,maxWidth:260}}><div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.subject}</div></td>
                        <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:GL+"44",color:"#7a5c10",borderRadius:20,padding:"2px 9px",fontWeight:500}}>{e.category}</span></td>
                        <td style={{padding:"10px 14px",fontSize:11}}>
                          <span style={{color:e.method?.includes("direct")?GR:BL,fontWeight:500}}>{e.method?.includes("direct")?"Direct":"Mail App"}</span>
                          {e.htmlMode && <div style={{fontSize:9,color:MU}}>HTML</div>}
                        </td>
                        <td style={{padding:"10px 14px"}}><span style={{fontSize:10,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 8px",fontWeight:500}}>{e.status||"Sent"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {tab==="templates" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:MU}}>{emailTemplates.length} templates ({emailTemplates.filter(t=>t.isDefault).length} built-in, {emailTemplates.filter(t=>!t.isDefault).length} custom)</div>
            <Btn onClick={openAddTpl} v="gold">+ New Template</Btn>
          </div>
          <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:11,color:BL,lineHeight:1.7}}>
            <strong>Merge fields:</strong> Use &#123;&#123;first_name&#125;&#125;, &#123;&#123;last_name&#125;&#125;, &#123;&#123;full_name&#125;&#125;, &#123;&#123;church_name&#125;&#125;, &#123;&#123;pastor_name&#125;&#125;, &#123;&#123;year&#125;&#125;, &#123;&#123;today&#125;&#125; in your subject and body. Pledge receipt templates can also use &#123;&#123;gift_date&#125;&#125;, &#123;&#123;gift_amount&#125;&#125;, &#123;&#123;gift_category&#125;&#125;, &#123;&#123;gift_method&#125;&#125;. Year-end templates can use &#123;&#123;total_given&#125;&#125;, &#123;&#123;gift_count&#125;&#125;.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
            {emailTemplates.map(tpl=>(
              <div key={tpl.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500,color:N}}>{tpl.name}</div>
                    <div style={{fontSize:11,color:MU,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2}}>{tpl.subject}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                    <span style={{fontSize:10,background:tpl.isDefault?GL+"44":"#e3f2fd",color:tpl.isDefault?"#7a5c10":BL,borderRadius:10,padding:"2px 7px",fontWeight:500}}>{tpl.isDefault?"Built-in":"Custom"}</span>
                  </div>
                </div>
                <div style={{fontSize:11,color:TX,background:BG,borderRadius:6,padding:"8px 10px",maxHeight:60,overflow:"hidden",lineHeight:1.5,marginBottom:10,border:"0.5px solid "+BR}}>{tpl.body.slice(0,140)}{tpl.body.length>140?"...":""}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:MU}}>{tpl.category}</span>
                  <div style={{display:"flex",gap:5}}>
                    <Btn onClick={()=>openEditTpl(tpl)} v="ghost" style={{fontSize:11,padding:"3px 9px"}}>Edit</Btn>
                    {!tpl.isDefault && <Btn onClick={()=>delTpl(tpl)} v="danger" style={{fontSize:11,padding:"3px 9px"}}>X</Btn>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERVICE TAB */}
      {tab==="service" && (
        <div>
          {cfgSaved && <div style={{background:"#dcfce7",border:"0.5px solid #86efac",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#14532d",fontWeight:500}}>Email service configuration saved.</div>}
          <div style={{background:GL+"22",border:"1px solid "+G,borderRadius:10,padding:"14px 18px",marginBottom:16,fontSize:13,color:"#7a5c10",lineHeight:1.7}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>About Email Sending</div>
            This app supports two ways to send email:<br/><br/>
            <strong>1. Open in Mail App (always available)</strong> — Opens your default email program (Gmail, Outlook, Apple Mail) with the message pre-filled. You review and click send. Emails come from your own email address.<br/><br/>
            <strong>2. Send Directly from App (requires configuration)</strong> — Sends email instantly through a provider like Resend or SendGrid. Requires a free API key and a bit of developer setup.
          </div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Direct Send Configuration</h3>
            <Fld label="Email Service Provider">
              <select value={emailConfig.provider||""} onChange={e=>setEmailConfig({...emailConfig,provider:e.target.value})} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
                <option value="">Not configured</option>
                <option value="resend">Resend (recommended — 3,000 free emails/month)</option>
                <option value="sendgrid">SendGrid (100 free emails/day)</option>
                <option value="mailgun">Mailgun</option>
                <option value="postmark">Postmark</option>
              </select>
            </Fld>
            <Fld label="API Key"><Inp type="password" value={emailConfig.apiKey||""} onChange={v=>setEmailConfig({...emailConfig,apiKey:v})} placeholder="Paste your API key here"/></Fld>
            <Fld label='Sender "From" Email'><Inp value={emailConfig.fromEmail||""} onChange={v=>setEmailConfig({...emailConfig,fromEmail:v})} placeholder={cs?.email||"noreply@yourchurch.org"}/></Fld>
            <Fld label='Sender "From" Name'><Inp value={emailConfig.fromName||""} onChange={v=>setEmailConfig({...emailConfig,fromName:v})} placeholder={cs?.name||"Your Church Name"}/></Fld>
            <Btn onClick={saveCfg} v="success">Save Configuration</Btn>
          </div>
          <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:10,padding:"12px 16px",fontSize:12,color:RE,lineHeight:1.7}}>
            <strong>Developer Note:</strong> Once you paste an API key above, a developer will need to wire up the sendDirectEmail() function with the correct API endpoint for your chosen provider. Until then, the UI is ready but clicking "Send Directly" will show a setup message. "Open in Mail App" works immediately with no setup required.
          </div>
        </div>
      )}

      {/* Log detail modal */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title="" width={560}>
        {detail && (()=>{const dt=new Date(detail.timestamp);return (
          <div style={{marginTop:-14}}>
            <div style={{paddingBottom:14,borderBottom:"0.5px solid "+BR,marginBottom:14}}>
              <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:3}}>Email Sent</div>
              <div style={{fontSize:17,fontWeight:500,color:N,marginBottom:6}}>{detail.subject}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:11,background:GL+"44",color:"#7a5c10",borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.category}</span>
                <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.status||"Sent"}</span>
                {detail.htmlMode && <span style={{fontSize:11,background:"#e3f2fd",color:BL,borderRadius:20,padding:"2px 10px",fontWeight:500}}>Branded HTML</span>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[["Sent",dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})+" at "+dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})],["Method",detail.method?.includes("direct")?"Sent directly":"Opened in mail app"],["To",detail.isBulk?detail.recipientCount+" recipients":(detail.toName?detail.toName+" <"+detail.to+">":detail.to)],["CC",detail.cc||"—"]].map(([k,v])=>v?<div key={k} style={{background:BG,borderRadius:8,padding:"8px 12px",border:"0.5px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>{k}</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{v}</div></div>:null)}
            </div>
            {detail.isBulk && detail.recipientList && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:MU,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Recipients ({detail.recipientCount})</div>
                <div style={{background:BG,borderRadius:8,padding:"8px 12px",border:"0.5px solid "+BR,fontSize:11,maxHeight:80,overflowY:"auto",lineHeight:1.7}}>{detail.recipientList}</div>
              </div>
            )}
            <div>
              <div style={{fontSize:11,color:MU,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Message</div>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:8,padding:"12px 14px",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",maxHeight:300,overflowY:"auto"}}>{detail.body}</div>
            </div>
          </div>
        );})()}
      </Modal>

      {/* Template edit modal */}
      <Modal open={tplModal} onClose={()=>setTplModal(false)} title={editTpl?"Edit Template":"New Email Template"} width={560}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Template Name *"><Inp value={tplForm.name} onChange={v=>setTplForm(f=>({...f,name:v}))} placeholder="e.g. New Member Welcome"/></Fld>
          <Fld label="Category"><select value={tplForm.category} onChange={e=>setTplForm(f=>({...f,category:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>{EMAIL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Fld>
        </div>
        <Fld label="Subject *"><Inp value={tplForm.subject} onChange={v=>setTplForm(f=>({...f,subject:v}))} placeholder="Use {{first_name}}, {{church_name}}, etc."/></Fld>
        <Fld label="Message Body *"><textarea value={tplForm.body} onChange={e=>setTplForm(f=>({...f,body:e.target.value}))} rows={12} placeholder="Write your template. Use {{first_name}}, {{pastor_name}}, {{church_name}}, etc." style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={saveTpl} v="success" style={{flex:1,justifyContent:"center"}}>Save Template</Btn>
          <Btn onClick={()=>setTplModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── EMAIL COMPOSER (Reusable Modal) ──
function EmailComposer({open,onClose,initialTo,initialToName,initialSubject,initialBody,initialCategory,relatedType,relatedId,cs,templates,onSend,emailConfig}){
  const [mode,setMode] = useState("mailto");
  const [htmlMode,setHtmlMode] = useState(false);
  const [to,setTo] = useState("");
  const [cc,setCc] = useState("");
  const [bcc,setBcc] = useState("");
  const [subject,setSubject] = useState("");
  const [body,setBody] = useState("");
  const [category,setCategory] = useState("General");
  const [toName,setToName] = useState("");
  const [showTemplates,setShowTemplates] = useState(false);
  const [sending,setSending] = useState(false);
  const [errorMsg,setErrorMsg] = useState("");

  useEffect(()=>{
    if(open){
      setTo(initialTo||"");
      setToName(initialToName||"");
      setSubject(initialSubject||"");
      setBody(initialBody||"");
      setCategory(initialCategory||"General");
      setCc(""); setBcc(""); setErrorMsg("");
      setShowTemplates(false);
    }
  },[open,initialTo,initialToName,initialSubject,initialBody,initialCategory]);

  const applyTemplate = (tpl) => {
    const vars = {
      first_name: (toName||"").split(" ")[0] || "Friend",
      last_name: (toName||"").split(" ").slice(1).join(" ") || "",
      full_name: toName || "Friend",
      church_name: cs?.name || "our church",
      pastor_name: cs?.pastorName || "Pastor",
      church_address: cs?.address || "",
      church_phone: cs?.phone || "",
      church_email: cs?.email || "",
      year: new Date().getFullYear()+"",
      today: new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
    };
    setSubject(renderTemplate(tpl.subject, vars));
    setBody(renderTemplate(tpl.body, vars));
    setCategory(tpl.category);
    setShowTemplates(false);
  };

  const doSend = async () => {
    if(!to.trim()){ setErrorMsg("Recipient email required."); return; }
    if(!subject.trim()){ setErrorMsg("Subject required."); return; }
    if(!body.trim()){ setErrorMsg("Message body required."); return; }
    setErrorMsg("");
    if(mode === "mailto"){
      const finalBody = htmlMode ? body : body;
      openMailto(to, subject, finalBody, cc, bcc);
      if(onSend) onSend({to,toName,cc,bcc,subject,body,category,htmlMode,method:"mailto",status:"Opened in mail app",relatedType,relatedId});
      onClose();
    } else {
      setSending(true);
      try {
        await sendDirectEmail(emailConfig, {to,cc,bcc,subject,body,html:htmlMode?buildHtmlEmail(subject,body,cs):null,from:cs?.email,fromName:cs?.name});
        if(onSend) onSend({to,toName,cc,bcc,subject,body,category,htmlMode,method:"direct",status:"Sent",relatedType,relatedId});
        setSending(false);
        onClose();
      } catch(e){
        setErrorMsg(e.message);
        setSending(false);
      }
    }
  };

  if(!open) return null;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000055",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:W,borderRadius:12,width:640,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:22,boxSizing:"border-box",border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:"0.5px solid "+BR}}>
          <div>
            <h2 style={{fontSize:17,fontWeight:500,color:N,margin:0}}>Compose Email</h2>
            <div style={{fontSize:11,color:MU,marginTop:2}}>{toName?"To "+toName:"New message"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:MU,lineHeight:1}}>x</button>
        </div>

        {/* Send Method Toggle */}
        <div style={{display:"flex",gap:0,background:BG,borderRadius:8,padding:3,marginBottom:14}}>
          <button onClick={()=>setMode("mailto")} style={{flex:1,padding:"8px 12px",border:"none",borderRadius:6,background:mode==="mailto"?W:"transparent",color:mode==="mailto"?N:MU,fontSize:12,fontWeight:mode==="mailto"?500:400,cursor:"pointer",boxShadow:mode==="mailto"?"0 1px 3px #00000010":"none"}}>Open in My Email App</button>
          <button onClick={()=>setMode("direct")} style={{flex:1,padding:"8px 12px",border:"none",borderRadius:6,background:mode==="direct"?W:"transparent",color:mode==="direct"?N:MU,fontSize:12,fontWeight:mode==="direct"?500:400,cursor:"pointer",boxShadow:mode==="direct"?"0 1px 3px #00000010":"none"}}>Send Directly from App{!emailConfig?.apiKey && " (not configured)"}</button>
        </div>

        {mode==="direct" && !emailConfig?.apiKey && (
          <div style={{background:"#fef9c3",border:"0.5px solid "+AM+"66",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#713f12",lineHeight:1.6}}>
            <strong>Direct send not configured.</strong> Go to Settings → Email Service to set up Resend, SendGrid, or another provider. You can still send via "Open in My Email App".
          </div>
        )}

        {/* Template picker */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={()=>setShowTemplates(v=>!v)} style={{background:N+"14",border:"0.5px solid "+N+"44",borderRadius:7,padding:"6px 12px",fontSize:12,color:N,cursor:"pointer",fontWeight:500}}>{showTemplates?"Hide":"Choose"} Template ({templates.length})</button>
          <div onClick={()=>setHtmlMode(v=>!v)} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <div style={{width:34,height:20,borderRadius:10,background:htmlMode?N:BR,position:"relative",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:htmlMode?17:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.15s"}}></div>
            </div>
            <span style={{fontSize:11,color:htmlMode?N:MU,fontWeight:500}}>{htmlMode?"Branded HTML":"Plain Text"}</span>
          </div>
        </div>

        {showTemplates && (
          <div style={{maxHeight:200,overflowY:"auto",border:"0.5px solid "+BR,borderRadius:8,padding:8,marginBottom:12,background:BG}}>
            {templates.map(tpl=>(
              <div key={tpl.id} onClick={()=>applyTemplate(tpl)} style={{padding:"8px 11px",borderRadius:6,cursor:"pointer",background:W,marginBottom:5,border:"0.5px solid "+BR,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background=N+"08"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:N}}>{tpl.name}</div>
                  <div style={{fontSize:10,color:MU,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tpl.subject}</div>
                </div>
                <span style={{fontSize:10,background:tpl.isDefault?GL+"44":"#e3f2fd",color:tpl.isDefault?"#7a5c10":BL,borderRadius:4,padding:"2px 6px",fontWeight:500,flexShrink:0}}>{tpl.category}</span>
              </div>
            ))}
          </div>
        )}

        <Fld label="To *"><Inp value={to} onChange={setTo} placeholder="recipient@example.com"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="CC (optional)"><Inp value={cc} onChange={setCc} placeholder="cc@example.com"/></Fld>
          <Fld label="BCC (optional)"><Inp value={bcc} onChange={setBcc} placeholder="bcc@example.com"/></Fld>
        </div>
        <Fld label="Subject *"><Inp value={subject} onChange={setSubject} placeholder="Email subject"/></Fld>
        <Fld label="Category">
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            {EMAIL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>
        <Fld label={"Message *"+(htmlMode?" (will be formatted as branded HTML on send)":"")}>
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={10} placeholder="Write your message..." style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>

        {errorMsg && <div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:RE}}>{errorMsg}</div>}

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={doSend} v={mode==="mailto"?"primary":"success"} style={{flex:1,justifyContent:"center",padding:"11px"}} disabled={sending}>{sending?"Sending...":mode==="mailto"?"Open in Email App":"Send Now"}</Btn>
          <Btn onClick={onClose} v="ghost" style={{padding:"11px 20px"}}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── BULK EMAIL COMPOSER ──
function BulkEmailComposer({open,onClose,recipients,initialSubject,initialBody,initialCategory,relatedType,cs,templates,onSend,emailConfig}){
  const [mode,setMode] = useState("mailto");
  const [htmlMode,setHtmlMode] = useState(false);
  const [subject,setSubject] = useState("");
  const [body,setBody] = useState("");
  const [category,setCategory] = useState("General");
  const [showTemplates,setShowTemplates] = useState(false);
  const [sending,setSending] = useState(false);
  const [errorMsg,setErrorMsg] = useState("");
  const [sendMode,setSendMode] = useState("bcc");

  useEffect(()=>{
    if(open){
      setSubject(initialSubject||"");
      setBody(initialBody||"");
      setCategory(initialCategory||"General");
      setErrorMsg(""); setShowTemplates(false);
    }
  },[open,initialSubject,initialBody,initialCategory]);

  const validRecipients = (recipients||[]).filter(r=>r.email);
  const missingEmail = (recipients||[]).filter(r=>!r.email);

  const applyTemplate = (tpl) => {
    const vars = {
      first_name: "{{first_name}}",
      last_name: "{{last_name}}",
      full_name: "{{full_name}}",
      church_name: cs?.name || "our church",
      pastor_name: cs?.pastorName || "Pastor",
      church_address: cs?.address || "",
      church_phone: cs?.phone || "",
      church_email: cs?.email || "",
      year: new Date().getFullYear()+"",
      today: new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
    };
    setSubject(renderTemplate(tpl.subject, vars));
    setBody(renderTemplate(tpl.body, vars));
    setCategory(tpl.category);
    setShowTemplates(false);
  };

  const doSend = async () => {
    if(validRecipients.length === 0){ setErrorMsg("No valid email addresses among recipients."); return; }
    if(!subject.trim()){ setErrorMsg("Subject required."); return; }
    if(!body.trim()){ setErrorMsg("Message body required."); return; }
    setErrorMsg("");
    if(mode === "mailto"){
      if(sendMode === "bcc"){
        const bccList = validRecipients.map(r=>r.email).join(",");
        openMailto("", subject, body, "", bccList);
        if(onSend) onSend({recipients:validRecipients,subject,body,category,htmlMode,method:"mailto-bcc",status:"Opened as BCC in mail app",relatedType});
      } else {
        let index = 0;
        const sendNext = () => {
          if(index >= validRecipients.length){ onClose(); return; }
          const r = validRecipients[index];
          const personalBody = body.replace(/\{\{first_name\}\}/g, (r.first||r.name||"").split(" ")[0]||"Friend").replace(/\{\{last_name\}\}/g, ((r.first||r.name||"").split(" ").slice(1).join(" "))||"").replace(/\{\{full_name\}\}/g, r.name||r.first+" "+(r.last||""));
          const personalSubject = subject.replace(/\{\{first_name\}\}/g, (r.first||r.name||"").split(" ")[0]||"Friend").replace(/\{\{full_name\}\}/g, r.name||r.first+" "+(r.last||""));
          openMailto(r.email, personalSubject, personalBody);
          index++;
          if(index < validRecipients.length) setTimeout(sendNext, 500);
        };
        sendNext();
        if(onSend) onSend({recipients:validRecipients,subject,body,category,htmlMode,method:"mailto-individual",status:"Opened "+validRecipients.length+" emails",relatedType});
      }
      onClose();
    } else {
      setSending(true);
      try {
        for(const r of validRecipients){
          await sendDirectEmail(emailConfig, {to:r.email,subject,body,html:htmlMode?buildHtmlEmail(subject,body,cs):null,from:cs?.email,fromName:cs?.name});
        }
        if(onSend) onSend({recipients:validRecipients,subject,body,category,htmlMode,method:"direct-bulk",status:"Sent to "+validRecipients.length,relatedType});
        setSending(false);
        onClose();
      } catch(e){
        setErrorMsg(e.message);
        setSending(false);
      }
    }
  };

  if(!open) return null;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000055",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:W,borderRadius:12,width:720,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:22,boxSizing:"border-box",border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:"0.5px solid "+BR}}>
          <div>
            <h2 style={{fontSize:17,fontWeight:500,color:N,margin:0}}>Bulk Email</h2>
            <div style={{fontSize:11,color:MU,marginTop:2}}>{validRecipients.length} recipient{validRecipients.length!==1?"s":""} with email · {missingEmail.length} missing email</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:MU,lineHeight:1}}>x</button>
        </div>

        {/* Recipients preview */}
        <div style={{background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"8px 12px",marginBottom:12,maxHeight:80,overflowY:"auto"}}>
          <div style={{fontSize:10,color:MU,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Recipients ({validRecipients.length})</div>
          <div style={{fontSize:11,color:TX,lineHeight:1.6}}>{validRecipients.map(r=>r.name||r.email).join(", ")}</div>
          {missingEmail.length>0 && <div style={{fontSize:10,color:AM,marginTop:4}}><strong>{missingEmail.length} skipped (no email):</strong> {missingEmail.slice(0,5).map(r=>r.name||"(no name)").join(", ")}{missingEmail.length>5?"...":""}</div>}
        </div>

        {/* Send method */}
        <div style={{display:"flex",gap:0,background:BG,borderRadius:8,padding:3,marginBottom:10}}>
          <button onClick={()=>setMode("mailto")} style={{flex:1,padding:"8px 12px",border:"none",borderRadius:6,background:mode==="mailto"?W:"transparent",color:mode==="mailto"?N:MU,fontSize:12,fontWeight:mode==="mailto"?500:400,cursor:"pointer",boxShadow:mode==="mailto"?"0 1px 3px #00000010":"none"}}>Open in My Email App</button>
          <button onClick={()=>setMode("direct")} style={{flex:1,padding:"8px 12px",border:"none",borderRadius:6,background:mode==="direct"?W:"transparent",color:mode==="direct"?N:MU,fontSize:12,fontWeight:mode==="direct"?500:400,cursor:"pointer",boxShadow:mode==="direct"?"0 1px 3px #00000010":"none"}}>Send Directly{!emailConfig?.apiKey && " (not configured)"}</button>
        </div>

        {mode==="mailto" && (
          <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:11,color:BL,lineHeight:1.6}}>
            <strong>Mailto mode:</strong> Choose BCC (all recipients in one email, hidden from each other) or Individual (opens one email per recipient with personalized name merge).
            <div style={{display:"flex",gap:6,marginTop:7}}>
              <button onClick={()=>setSendMode("bcc")} style={{padding:"4px 11px",borderRadius:6,border:"0.5px solid "+(sendMode==="bcc"?BL:BR),background:sendMode==="bcc"?BL:W,color:sendMode==="bcc"?"#fff":TX,fontSize:11,cursor:"pointer",fontWeight:500}}>BCC All (1 email)</button>
              <button onClick={()=>setSendMode("individual")} style={{padding:"4px 11px",borderRadius:6,border:"0.5px solid "+(sendMode==="individual"?BL:BR),background:sendMode==="individual"?BL:W,color:sendMode==="individual"?"#fff":TX,fontSize:11,cursor:"pointer",fontWeight:500}}>Individual ({validRecipients.length} emails, personalized)</button>
            </div>
          </div>
        )}

        {mode==="direct" && !emailConfig?.apiKey && (
          <div style={{background:"#fef9c3",border:"0.5px solid "+AM+"66",borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:11,color:"#713f12",lineHeight:1.6}}>
            <strong>Direct send not configured.</strong> Set up an email provider in Settings → Email Service.
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={()=>setShowTemplates(v=>!v)} style={{background:N+"14",border:"0.5px solid "+N+"44",borderRadius:7,padding:"6px 12px",fontSize:12,color:N,cursor:"pointer",fontWeight:500}}>{showTemplates?"Hide":"Choose"} Template</button>
          <div onClick={()=>setHtmlMode(v=>!v)} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <div style={{width:34,height:20,borderRadius:10,background:htmlMode?N:BR,position:"relative",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:htmlMode?17:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.15s"}}></div>
            </div>
            <span style={{fontSize:11,color:htmlMode?N:MU,fontWeight:500}}>{htmlMode?"Branded HTML":"Plain Text"}</span>
          </div>
        </div>

        {showTemplates && (
          <div style={{maxHeight:160,overflowY:"auto",border:"0.5px solid "+BR,borderRadius:8,padding:8,marginBottom:10,background:BG}}>
            {templates.map(tpl=>(
              <div key={tpl.id} onClick={()=>applyTemplate(tpl)} style={{padding:"7px 10px",borderRadius:6,cursor:"pointer",background:W,marginBottom:4,border:"0.5px solid "+BR,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500}}>{tpl.name}</div><div style={{fontSize:10,color:MU,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tpl.subject}</div></div>
                <span style={{fontSize:10,background:GL+"44",color:"#7a5c10",borderRadius:4,padding:"2px 6px"}}>{tpl.category}</span>
              </div>
            ))}
          </div>
        )}

        <Fld label="Subject *"><Inp value={subject} onChange={setSubject} placeholder="Email subject — use {{first_name}} for personalization"/></Fld>
        <Fld label="Category">
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            {EMAIL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>
        <Fld label="Message * (use {{first_name}}, {{full_name}}, {{church_name}} for personalization)">
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={9} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>

        {errorMsg && <div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:RE}}>{errorMsg}</div>}

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={doSend} v="success" style={{flex:1,justifyContent:"center",padding:"11px"}} disabled={sending}>{sending?"Sending...":"Send to "+validRecipients.length+" Recipient"+(validRecipients.length!==1?"s":"")}</Btn>
          <Btn onClick={onClose} v="ghost" style={{padding:"11px 20px"}}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SMS SYSTEM ──
const SMS_CATEGORIES=["General","Follow-Up","Welcome","Prayer","Event","Pastoral","Birthday","Announcement","Emergency"];

const DEFAULT_SMS_TEMPLATES=[
  {id:"sms_1",name:"First-Visit Welcome",category:"Welcome",isDefault:true,body:"Hi {first}! We're so glad you joined us at {church} this Sunday. Pastor {pastor} and the whole family are praying for you. We'd love to see you again soon!"},
  {id:"sms_2",name:"Missed You Follow-Up",category:"Follow-Up",isDefault:true,body:"Hi {first}, this is {church}. We've missed you! You're in our prayers. Please reach out anytime if you need anything. — Pastor {pastor}"},
  {id:"sms_3",name:"Event Reminder",category:"Event",isDefault:true,body:"Hi {first}! Just a reminder about service this Sunday at {church}. We'd love to see you there. Blessings!"},
  {id:"sms_4",name:"Birthday Blessing",category:"Birthday",isDefault:true,body:"Happy Birthday {first}! May God fill this year with grace, favor, and joy. We're celebrating you! Love, {church}"},
  {id:"sms_5",name:"Prayer Response",category:"Prayer",isDefault:true,body:"Hi {first}, we received your prayer request and are standing with you before God. He hears every prayer. — {church}"},
  {id:"sms_6",name:"Absent Member",category:"Follow-Up",isDefault:true,body:"Hi {first}, we've missed seeing you at {church}. You are loved and prayed for. Please reach out if you need anything. God bless!"},
];

function smsStats(text){
  const len=text.length;
  const hasUnicode=/[^\u0000-\u00FF]/.test(text);
  const singleMax=hasUnicode?70:160;
  const multiMax=hasUnicode?67:153;
  if(len<=singleMax) return{chars:len,segments:1,remaining:singleMax-len};
  const segments=Math.ceil(len/multiMax);
  return{chars:len,segments,remaining:segments*multiMax-len};
}

function smsPersonalize(text,person,cs){
  const first=(person?.first||(person?.name||"").split(" ")[0]||"Friend");
  const last=(person?.last||(person?.name||"").split(" ").slice(1).join(" ")||"");
  const church=cs?.name||"our church";
  const pastorRaw=cs?.pastorName||"our Pastor";
  const pastor=pastorRaw.replace(/^Pastor\s*/i,"").trim()||pastorRaw;
  return text
    .replace(/\{first\}/g,first)
    .replace(/\{last\}/g,last)
    .replace(/\{full\}/g,(first+" "+last).trim())
    .replace(/\{church\}/g,church)
    .replace(/\{pastor\}/g,pastor);
}

// ── SMS COMPOSER (Single Recipient) ──
function SmsComposer({open,onClose,initialPhone,initialName,initialBody,initialCategory,relatedType,relatedId,cs,templates,members,visitors,onSend}){
  const [phone,setPhone]=useState("");
  const [toName,setToName]=useState("");
  const [body,setBody]=useState("");
  const [category,setCategory]=useState("General");
  const [showTpl,setShowTpl]=useState(false);
  const [pickerMode,setPickerMode]=useState("manual");
  const [pickerId,setPickerId]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [copied,setCopied]=useState(false);
  const [errorMsg,setErrorMsg]=useState("");

  const stats=smsStats(body);

  useEffect(()=>{
    if(open){
      setPhone(initialPhone||"");
      setToName(initialName||"");
      setBody(initialBody||"");
      setCategory(initialCategory||"General");
      setShowTpl(false);setCopied(false);setErrorMsg("");
      setPickerMode("manual");setPickerId("");
    }
  },[open,initialPhone,initialName,initialBody,initialCategory]);

  const allPeople=[
    ...members.filter(m=>m.phone).map(m=>({...m,_type:"member",label:m.first+" "+m.last+" (Member)"})),
    ...visitors.filter(v=>v.phone).map(v=>({...v,_type:"visitor",label:v.first+" "+v.last+" (Visitor)"})),
  ];

  const pickPerson=id=>{
    const p=allPeople.find(x=>String(x.id)===id);
    if(p){setPhone(p.phone);setToName(p.first+" "+(p.last||""));}
    setPickerId(id);
  };

  const applyTemplate=tpl=>{
    const person={first:(toName||"").split(" ")[0]||"Friend",last:(toName||"").split(" ").slice(1).join(" ")};
    setBody(smsPersonalize(tpl.body,person,cs));
    setCategory(tpl.category);setShowTpl(false);
  };

  const genAI=async()=>{
    setAiLoad(true);
    try{
      const name=toName||"a church member";
      const prompt=`Write a warm, brief pastoral SMS (max 155 chars) from ${cs?.pastorName||"Pastor"} at ${cs?.name||"our church"} to ${name}. Category: ${category}. Faith-filled, personal, conversational. Output only the message text, no quotes.`;
      const result=await callAI(prompt,members,visitors,[],[],[],{});
      setBody(result.slice(0,320));
    }catch(e){setBody("Praying for you today, "+((toName||"").split(" ")[0]||"friend")+"! May God's grace surround you. — "+(cs?.name||"our church"));}
    setAiLoad(false);
  };

  const doSmsLink=()=>{
    if(!phone.trim()){setErrorMsg("Phone number required.");return;}
    if(!body.trim()){setErrorMsg("Message required.");return;}
    setErrorMsg("");
    const clean=phone.replace(/\D/g,"");
    window.open("sms:"+clean+"?body="+encodeURIComponent(body),"_blank");
    if(onSend) onSend({to:phone,toName,body,category,method:"sms-link",status:"Opened in SMS App",relatedType,relatedId});
    onClose();
  };

  const doCopy=()=>{
    if(!body.trim()){setErrorMsg("Message required.");return;}
    setErrorMsg("");
    const text=toName?"To: "+toName+(phone?" ("+phone+")":"")+"\n\n"+body:body;
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
    if(onSend) onSend({to:phone,toName,body,category,method:"copy",status:"Copied to clipboard",relatedType,relatedId});
  };

  if(!open) return null;
  const segColor=stats.segments===1?GR:stats.segments===2?AM:RE;

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000055",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:W,borderRadius:12,width:520,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:22,boxSizing:"border-box",border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:"0.5px solid "+BR}}>
          <div>
            <h2 style={{fontSize:17,fontWeight:500,color:N,margin:0}}>Compose SMS</h2>
            <div style={{fontSize:11,color:MU,marginTop:2}}>{toName?"To "+toName:"New text message"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:MU,lineHeight:1}}>×</button>
        </div>

        {/* Recipient picker */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",gap:5,marginBottom:8}}>
            {[["manual","Type Number"],["pick","Pick from Directory"]].map(([m,lbl])=>(
              <button key={m} onClick={()=>setPickerMode(m)} style={{flex:1,padding:"7px 10px",borderRadius:7,border:"0.5px solid "+(pickerMode===m?N:BR),background:pickerMode===m?N:W,color:pickerMode===m?"#fff":TX,fontSize:12,cursor:"pointer",fontWeight:pickerMode===m?500:400}}>{lbl}</button>
            ))}
          </div>
          {pickerMode==="manual"?(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Fld label="Phone Number *"><Inp value={phone} onChange={setPhone} placeholder="(623) 555-0100"/></Fld>
              <Fld label="Name (optional)"><Inp value={toName} onChange={setToName} placeholder="First Last"/></Fld>
            </div>
          ):(
            <Fld label="Select Member or Visitor">
              <select value={pickerId} onChange={e=>pickPerson(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
                <option value="">— Choose person —</option>
                {allPeople.map(p=><option key={p._type+p.id} value={String(p.id)}>{p.label} — {p.phone}</option>)}
              </select>
            </Fld>
          )}
          {phone&&<div style={{fontSize:11,color:MU,marginTop:4}}>📱 {phone}</div>}
        </div>

        <Fld label="Category">
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            {SMS_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>

        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
          <button onClick={()=>setShowTpl(v=>!v)} style={{background:N+"14",border:"0.5px solid "+N+"44",borderRadius:7,padding:"6px 12px",fontSize:12,color:N,cursor:"pointer",fontWeight:500}}>{showTpl?"Hide":"Use"} Template ({templates.length})</button>
          <button onClick={genAI} disabled={aiLoad} style={{background:GL,border:"1px solid "+G,borderRadius:7,padding:"6px 12px",fontSize:12,color:"#7a5c10",cursor:"pointer",fontWeight:500}}>{aiLoad?"Writing...":"✦ AI Draft"}</button>
        </div>

        {showTpl&&(
          <div style={{maxHeight:180,overflowY:"auto",border:"0.5px solid "+BR,borderRadius:8,padding:8,marginBottom:12,background:BG}}>
            {templates.map(tpl=>(
              <div key={tpl.id} onClick={()=>applyTemplate(tpl)} style={{padding:"8px 11px",borderRadius:6,cursor:"pointer",background:W,marginBottom:5,border:"0.5px solid "+BR}} onMouseEnter={e=>e.currentTarget.style.background=N+"08"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                <div style={{fontSize:12,fontWeight:500,color:N,marginBottom:2}}>{tpl.name} <span style={{fontSize:10,color:MU}}>— {tpl.category}</span></div>
                <div style={{fontSize:11,color:MU,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{tpl.body.slice(0,90)}...</div>
              </div>
            ))}
          </div>
        )}

        <Fld label="Message *">
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder={"Type your message... Use {first}, {church}, {pastor} as merge fields"} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:11,color:MU}}>Merge fields: {"{first}"} {"{church}"} {"{pastor}"}</div>
          <div style={{fontSize:11,fontWeight:500,color:segColor}}>{stats.chars} chars · {stats.segments} segment{stats.segments!==1?"s":""} · {stats.remaining} left</div>
        </div>

        {errorMsg&&<div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:RE}}>{errorMsg}</div>}

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={doSmsLink} v="primary" style={{flex:1,justifyContent:"center",minWidth:140}}>📱 Open SMS App</Btn>
          <Btn onClick={doCopy} v={copied?"success":"outline"} style={{flex:1,justifyContent:"center",minWidth:120}}>{copied?"✓ Copied!":"Copy Message"}</Btn>
          <Btn onClick={onClose} v="ghost" style={{padding:"10px 16px"}}>Cancel</Btn>
        </div>
        <div style={{fontSize:10,color:MU,marginTop:10,lineHeight:1.5}}>"Open SMS App" pre-fills your phone's messaging app. "Copy Message" puts it on your clipboard. Twilio direct-send can be wired in from SMS Service config when ready.</div>
      </div>
    </div>
  );
}

// ── BULK SMS COMPOSER ──
function BulkSmsComposer({open,onClose,recipients,initialBody,initialCategory,relatedType,cs,templates,members,visitors,onSend}){
  const [body,setBody]=useState("");
  const [category,setCategory]=useState("General");
  const [showTpl,setShowTpl]=useState(false);
  const [preview,setPreview]=useState(null);
  const [aiLoad,setAiLoad]=useState(false);
  const [allCopied,setAllCopied]=useState(false);
  const [errorMsg,setErrorMsg]=useState("");

  useEffect(()=>{
    if(open){setBody(initialBody||"");setCategory(initialCategory||"General");setShowTpl(false);setPreview(null);setAllCopied(false);setErrorMsg("");}
  },[open,initialBody,initialCategory]);

  const pool=(recipients&&recipients.length>0)?recipients:[
    ...members.filter(m=>m.phone).map(m=>({...m,_type:"member"})),
    ...visitors.filter(v=>v.phone).map(v=>({...v,_type:"visitor"})),
  ];
  const withPhone=pool.filter(p=>p.phone);
  const noPhone=pool.filter(p=>!p.phone);
  const stats=smsStats(body);
  const personalize=p=>smsPersonalize(body,p,cs);

  const applyTemplate=tpl=>{setBody(tpl.body);setCategory(tpl.category);setShowTpl(false);};

  const genAI=async()=>{
    setAiLoad(true);
    try{
      const prompt=`Write a warm, brief pastoral SMS (under 155 chars) from ${cs?.pastorName||"Pastor"} at ${cs?.name||"our church"} to multiple members. Category: ${category}. Use {first} as name placeholder. Faith-filled and conversational. Output only the message text.`;
      const result=await callAI(prompt,members,visitors,[],[],[],{});
      setBody(result.slice(0,320));
    }catch(e){setBody("Hi {first}, greetings from "+(cs?.name||"our church")+"! You are loved and prayed for. God bless you today.");}
    setAiLoad(false);
  };

  const copyAll=()=>{
    if(!body.trim()){setErrorMsg("Message required.");return;}
    setErrorMsg("");
    const lines=withPhone.map(p=>"To: "+((p.first||"")+" "+(p.last||"")).trim()+" ("+p.phone+")\n"+personalize(p));
    navigator.clipboard.writeText(lines.join("\n\n---\n\n")).then(()=>{setAllCopied(true);setTimeout(()=>setAllCopied(false),3000);});
    if(onSend) onSend({recipients:withPhone,body,category,isBulk:true,recipientCount:withPhone.length,method:"copy-all",status:"All "+withPhone.length+" messages copied",relatedType});
  };

  if(!open) return null;
  const segColor=stats.segments===1?GR:stats.segments===2?AM:RE;

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000055",zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:W,borderRadius:12,width:680,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:22,boxSizing:"border-box",border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:"0.5px solid "+BR}}>
          <div>
            <h2 style={{fontSize:17,fontWeight:500,color:N,margin:0}}>Bulk SMS</h2>
            <div style={{fontSize:11,color:MU,marginTop:2}}>{withPhone.length} recipient{withPhone.length!==1?"s":""} with phone · {noPhone.length} missing phone</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:MU,lineHeight:1}}>×</button>
        </div>

        <div style={{background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"8px 12px",marginBottom:14,maxHeight:72,overflowY:"auto"}}>
          <div style={{fontSize:10,color:MU,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Recipients ({withPhone.length} with phone)</div>
          <div style={{fontSize:11,color:TX,lineHeight:1.7}}>{withPhone.slice(0,20).map(p=>((p.first||"")+" "+(p.last||"")).trim()).join(", ")}{withPhone.length>20?" ... and "+(withPhone.length-20)+" more":""}</div>
          {noPhone.length>0&&<div style={{fontSize:10,color:AM,marginTop:3}}><strong>{noPhone.length} skipped (no phone):</strong> {noPhone.slice(0,5).map(p=>p.first||p.name||"").join(", ")}{noPhone.length>5?"...":""}</div>}
        </div>

        <Fld label="Category">
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            {SMS_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setShowTpl(v=>!v)} style={{background:N+"14",border:"0.5px solid "+N+"44",borderRadius:7,padding:"6px 12px",fontSize:12,color:N,cursor:"pointer",fontWeight:500}}>{showTpl?"Hide":"Use"} Template</button>
          <button onClick={genAI} disabled={aiLoad} style={{background:GL,border:"1px solid "+G,borderRadius:7,padding:"6px 12px",fontSize:12,color:"#7a5c10",cursor:"pointer",fontWeight:500}}>{aiLoad?"Writing...":"✦ AI Draft"}</button>
        </div>

        {showTpl&&(
          <div style={{maxHeight:160,overflowY:"auto",border:"0.5px solid "+BR,borderRadius:8,padding:8,marginBottom:10,background:BG}}>
            {templates.map(tpl=>(
              <div key={tpl.id} onClick={()=>applyTemplate(tpl)} style={{padding:"8px 11px",borderRadius:6,cursor:"pointer",background:W,marginBottom:4,border:"0.5px solid "+BR}} onMouseEnter={e=>e.currentTarget.style.background=N+"08"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                <div style={{fontSize:12,fontWeight:500,color:N,marginBottom:2}}>{tpl.name}</div>
                <div style={{fontSize:11,color:MU,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{tpl.body.slice(0,100)}</div>
              </div>
            ))}
          </div>
        )}

        <Fld label={"Message * — use {first}, {church}, {pastor}"}>
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder={"Hi {first}, greetings from {church}! ..."} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={()=>setPreview(preview?null:withPhone[0])} style={{background:"none",border:"0.5px solid "+BR,borderRadius:6,padding:"4px 10px",fontSize:11,color:N,cursor:"pointer"}}>{preview?"Hide":"Preview"} personalized</button>
          <div style={{fontSize:11,fontWeight:500,color:segColor}}>{stats.chars} chars · {stats.segments} segment{stats.segments!==1?"s":""} · {stats.remaining} left</div>
        </div>

        {preview&&body&&(
          <div style={{background:"#f0fdf4",border:"0.5px solid #86efac",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,lineHeight:1.7}}>
            <div style={{fontSize:10,color:MU,fontWeight:500,marginBottom:4}}>PREVIEW — {((preview.first||"")+" "+(preview.last||"")).trim()} ({preview.phone})</div>
            <div style={{whiteSpace:"pre-wrap"}}>{personalize(preview)}</div>
            <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
              {withPhone.indexOf(preview)>0&&<button onClick={()=>setPreview(withPhone[withPhone.indexOf(preview)-1])} style={{fontSize:11,padding:"2px 8px",borderRadius:5,border:"0.5px solid "+BR,background:W,cursor:"pointer"}}>← Prev</button>}
              {withPhone.indexOf(preview)<withPhone.length-1&&<button onClick={()=>setPreview(withPhone[withPhone.indexOf(preview)+1])} style={{fontSize:11,padding:"2px 8px",borderRadius:5,border:"0.5px solid "+BR,background:W,cursor:"pointer"}}>Next →</button>}
              <span style={{fontSize:10,color:MU,marginLeft:"auto"}}>{withPhone.indexOf(preview)+1} of {withPhone.length}</span>
            </div>
          </div>
        )}

        {errorMsg&&<div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:RE}}>{errorMsg}</div>}

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={copyAll} v={allCopied?"success":"gold"} style={{flex:1,justifyContent:"center",minWidth:180}}>{allCopied?"✓ All "+withPhone.length+" Copied!":"Copy All "+withPhone.length+" Messages"}</Btn>
          <Btn onClick={onClose} v="ghost" style={{padding:"10px 16px"}}>Cancel</Btn>
        </div>
        <div style={{fontSize:10,color:MU,marginTop:10,lineHeight:1.6}}>"Copy All" copies every personalized message with the recipient's name and phone, separated by dividers — ready to paste into Notepad, Excel, or your SMS tool. Twilio batch-send can be wired in from SMS Service config when ready.</div>
      </div>
    </div>
  );
}

// ── SMS CENTER PAGE ──
function SmsCenter({smsLog,setSmsLog,smsTemplates,setSmsTemplates,smsConfig,setSmsConfig,members,visitors,cs,onCompose,onBulkCompose}){
  const [tab,setTab]=useState("log");
  const [search,setSearch]=useState("");
  const [detail,setDetail]=useState(null);
  const [tplModal,setTplModal]=useState(false);
  const [editTpl,setEditTpl]=useState(null);
  const [tplForm,setTplForm]=useState({name:"",category:"General",body:""});
  const [cfgSaved,setCfgSaved]=useState(false);

  const stats={
    total:smsLog.length,
    individual:smsLog.filter(s=>!s.isBulk).length,
    bulk:smsLog.filter(s=>s.isBulk).length,
    thisMonth:smsLog.filter(s=>s.timestamp?.startsWith(new Date().toISOString().slice(0,7))).length,
  };
  const filtered=smsLog.filter(s=>{
    if(!search) return true;
    return (s.toName||"").toLowerCase().includes(search.toLowerCase())||(s.to||"").includes(search)||(s.body||"").toLowerCase().includes(search.toLowerCase())||(s.category||"").toLowerCase().includes(search.toLowerCase());
  });

  const openAddTpl=()=>{setEditTpl(null);setTplForm({name:"",category:"General",body:""});setTplModal(true);};
  const openEditTpl=t=>{setEditTpl(t);setTplForm({name:t.name,category:t.category,body:t.body});setTplModal(true);};
  const saveTpl=()=>{
    if(!tplForm.name||!tplForm.body){alert("Name and body required.");return;}
    if(editTpl) setSmsTemplates(ts=>ts.map(t=>t.id===editTpl.id?{...t,...tplForm}:t));
    else setSmsTemplates(ts=>[...ts,{...tplForm,id:"sms_custom_"+Date.now(),isDefault:false}]);
    setTplModal(false);
  };
  const delTpl=t=>{if(t.isDefault){alert("Built-in templates can be edited but not deleted.");return;}if(confirm("Delete?")) setSmsTemplates(ts=>ts.filter(x=>x.id!==t.id));};

  const TABS=[{id:"log",label:"SMS Log",count:smsLog.length},{id:"templates",label:"Templates",count:smsTemplates.length},{id:"service",label:"SMS Service"}];

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>SMS Center</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Compose, track, and template every text message sent from this app</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onCompose} v="primary">+ Compose SMS</Btn>
          <Btn onClick={onBulkCompose} v="gold">Bulk SMS</Btn>
        </div>
      </div>

      <div style={{display:"flex",marginBottom:18,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===t.id?G:"transparent"),background:tab===t.id?"#f8f9fc":W,fontSize:13,fontWeight:tab===t.id?500:400,color:tab===t.id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {t.label}
            {t.count!==undefined&&t.count>0&&<span style={{background:N+"22",color:N,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab==="log"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <Stat label="Total Sent" value={stats.total}/>
            <Stat label="Individual" value={stats.individual} color={BL}/>
            <Stat label="Bulk" value={stats.bulk} color={G}/>
            <Stat label="This Month" value={stats.thisMonth} color={GR}/>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages, recipients..." style={{width:"100%",padding:"9px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
          {filtered.length===0?(
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
              <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>{smsLog.length===0?"No SMS sent yet":"No messages match your search"}</h3>
              <p style={{fontSize:13,color:MU,marginBottom:16}}>{smsLog.length===0?"Click Compose SMS to send your first text.":""}</p>
              {smsLog.length===0&&<Btn onClick={onCompose}>+ Compose First SMS</Btn>}
            </div>
          ):(
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f8f9fc"}}>{["When","To","Message","Category","Method","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(s=>{
                    const dt=new Date(s.timestamp);
                    return(
                      <tr key={s.id} onClick={()=>setDetail(s)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={ev=>ev.currentTarget.style.background="#f8f9fc"} onMouseLeave={ev=>ev.currentTarget.style.background=W}>
                        <td style={{padding:"10px 14px",fontSize:12}}><div style={{fontWeight:500}}>{dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div><div style={{fontSize:10,color:MU}}>{dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div></td>
                        <td style={{padding:"10px 14px",fontSize:13}}>{s.isBulk?<div><div style={{fontWeight:500}}>{s.recipientCount} recipients</div><div style={{fontSize:10,color:MU}}>bulk</div></div>:<div><div style={{fontWeight:500}}>{s.toName||s.to}</div>{s.toName&&<div style={{fontSize:10,color:MU}}>{s.to}</div>}</div>}</td>
                        <td style={{padding:"10px 14px",fontSize:12,maxWidth:220}}><div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:TX}}>{(s.body||"").slice(0,70)}</div></td>
                        <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:"#ede9fe",color:PU,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{s.category}</span></td>
                        <td style={{padding:"10px 14px",fontSize:11,fontWeight:500,color:s.method==="sms-link"?GR:BL}}>{s.method==="sms-link"?"SMS App":s.method==="copy"?"Copied":"Bulk Copy"}</td>
                        <td style={{padding:"10px 14px"}}><span style={{fontSize:10,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 8px",fontWeight:500}}>{s.status||"Sent"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==="templates"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:MU}}>{smsTemplates.length} templates ({smsTemplates.filter(t=>t.isDefault).length} built-in, {smsTemplates.filter(t=>!t.isDefault).length} custom)</div>
            <Btn onClick={openAddTpl} v="gold">+ New Template</Btn>
          </div>
          <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:11,color:BL,lineHeight:1.7}}>
            <strong>Merge fields:</strong> Use <strong>{"{first}"}</strong> (first name), <strong>{"{church}"}</strong> (church name), <strong>{"{pastor}"}</strong> (pastor name). Keep under 160 chars for a single SMS segment.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {smsTemplates.map(tpl=>(
              <div key={tpl.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:500,color:N}}>{tpl.name}</div><div style={{fontSize:11,color:MU,marginTop:2}}>{tpl.category}</div></div>
                  <span style={{fontSize:10,background:tpl.isDefault?GL+"44":"#e3f2fd",color:tpl.isDefault?"#7a5c10":BL,borderRadius:10,padding:"2px 7px",fontWeight:500,flexShrink:0,marginLeft:8}}>{tpl.isDefault?"Built-in":"Custom"}</span>
                </div>
                <div style={{fontSize:12,color:TX,background:BG,borderRadius:6,padding:"8px 10px",lineHeight:1.6,marginBottom:10,border:"0.5px solid "+BR,minHeight:50}}>{tpl.body}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:tpl.body.length>160?RE:MU}}>{tpl.body.length} chars</span>
                  <div style={{display:"flex",gap:5}}>
                    <Btn onClick={()=>openEditTpl(tpl)} v="ghost" style={{fontSize:11,padding:"3px 9px"}}>Edit</Btn>
                    {!tpl.isDefault&&<Btn onClick={()=>delTpl(tpl)} v="danger" style={{fontSize:11,padding:"3px 9px"}}>X</Btn>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="service"&&(
        <div>
          {cfgSaved&&<div style={{background:"#dcfce7",border:"0.5px solid #86efac",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#14532d",fontWeight:500}}>SMS service configuration saved.</div>}
          <div style={{background:GL+"22",border:"1px solid "+G,borderRadius:10,padding:"14px 18px",marginBottom:16,fontSize:13,color:"#7a5c10",lineHeight:1.8}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>About SMS Sending</div>
            <strong>1. Open in SMS App (always works)</strong> — Pre-fills your phone's native messaging app with the text ready to send.<br/>
            <strong>2. Copy Message (always works)</strong> — Copies text to clipboard so you can paste into any messaging tool.<br/>
            <strong>3. Twilio Direct Send (requires credentials)</strong> — Sends SMS from within the app using your Twilio account. Paste credentials below — a developer will wire the send function.
          </div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Twilio Configuration</h3>
            <Fld label="Account SID"><Inp value={smsConfig.accountSid||""} onChange={v=>setSmsConfig(c=>({...c,accountSid:v}))} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/></Fld>
            <Fld label="Auth Token"><Inp type="password" value={smsConfig.authToken||""} onChange={v=>setSmsConfig(c=>({...c,authToken:v}))} placeholder="Your Twilio auth token"/></Fld>
            <Fld label="From Phone Number"><Inp value={smsConfig.fromPhone||""} onChange={v=>setSmsConfig(c=>({...c,fromPhone:v}))} placeholder="+16235550100"/></Fld>
            <Btn onClick={()=>{setCfgSaved(true);setTimeout(()=>setCfgSaved(false),2500);}} v="success">Save Configuration</Btn>
          </div>
          <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:10,padding:"12px 16px",fontSize:12,color:RE,lineHeight:1.7}}>
            <strong>Developer Note:</strong> Once credentials are saved, wire <code>sendDirectSms(smsConfig, to, body)</code> to call the Twilio Messages API (<code>POST /2010-04-01/Accounts/{"{SID}"}/Messages.json</code>). "Open in SMS App" and "Copy" work immediately with zero setup.
          </div>
        </div>
      )}

      <Modal open={!!detail} onClose={()=>setDetail(null)} title="" width={500}>
        {detail&&(()=>{const dt=new Date(detail.timestamp);return(
          <div style={{marginTop:-14}}>
            <div style={{paddingBottom:14,borderBottom:"0.5px solid "+BR,marginBottom:14}}>
              <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600,marginBottom:6}}>SMS Sent</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:11,background:"#ede9fe",color:PU,borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.category}</span>
                <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.status||"Sent"}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[["Sent",dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})+" at "+dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})],["Method",detail.method==="sms-link"?"SMS App":detail.method==="copy"?"Copied to clipboard":"Bulk copy"],["To",detail.isBulk?detail.recipientCount+" recipients":(detail.toName?detail.toName+" ("+detail.to+")":detail.to)]].map(([k,v])=>v?<div key={k} style={{background:BG,borderRadius:8,padding:"8px 12px",border:"0.5px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>{k}</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{v}</div></div>:null)}
            </div>
            <div>
              <div style={{fontSize:11,color:MU,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Message</div>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:8,padding:"12px 14px",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{detail.body}</div>
            </div>
          </div>
        );})()}
      </Modal>

      <Modal open={tplModal} onClose={()=>setTplModal(false)} title={editTpl?"Edit SMS Template":"New SMS Template"} width={460}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Template Name *"><Inp value={tplForm.name} onChange={v=>setTplForm(f=>({...f,name:v}))} placeholder="e.g. Birthday Blessing"/></Fld>
          <Fld label="Category"><select value={tplForm.category} onChange={e=>setTplForm(f=>({...f,category:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>{SMS_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Fld>
        </div>
        <Fld label={"Message Body * (use {first}, {church}, {pastor})"}>
          <textarea value={tplForm.body} onChange={e=>setTplForm(f=>({...f,body:e.target.value}))} rows={4} placeholder={"Hi {first}, ..."} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
          <div style={{fontSize:11,color:tplForm.body.length>160?RE:MU,marginTop:4,textAlign:"right"}}>{tplForm.body.length} / 160 chars{tplForm.body.length>160?" ("+Math.ceil(tplForm.body.length/153)+" segments)":""}</div>
        </Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={saveTpl} v="success" style={{flex:1,justifyContent:"center"}}>Save Template</Btn>
          <Btn onClick={()=>setTplModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── VISITATION ──
function Visitation({visitors,setVisitors,members,setMembers,users,visitRecords,setVisitRecords,setView}:any) {
  const [tab,setTab] = useState("pipeline");
  const [logModal,setLogModal] = useState(null);
  const [assignModal,setAssignModal] = useState(null);
  const [logForm,setLogForm] = useState({method:"Call",date:td(),notes:"",completed:false});
  const [assignUid,setAssignUid] = useState("");
  const [expandedId,setExpandedId] = useState(null);
  const [careAlertDismissed,setCareAlertDismissed] = useState(false);
  const [aiRep,setAiRep] = useState("");
  const [aiLoad,setAiLoad] = useState(false);
  const nid = useRef(700);

  useEffect(()=>{
    const missing = visitors.filter(v=>!visitRecords.find(r=>r.visitorId===v.id));
    if(missing.length>0) setVisitRecords(rs=>[...rs,...missing.map(v=>({id:nid.current++,visitorId:v.id,stage:"Pastor",createdDate:v.firstVisit||td(),contacts:[],teamLeaderUserId:null,sponsorUserId:null}))]);
  },[visitors.length]);

  const getRec = vid => visitRecords.find(r=>r.visitorId===vid);
  const getV = vid => visitors.find(v=>v.id===vid);
  const getUName = uid => {
    if(!uid) return "None";
    const u = users.find(x=>x.id===uid);
    if(!u) return "Unknown";
    const m = members.find(x=>x.id===u.memberId);
    return m ? m.first+" "+m.last : "Unknown";
  };
  const getAssigned = rec => {
    if(!rec) return "—";
    if(rec.stage==="Pastor") return "Pastor Hall";
    if(rec.stage==="TeamLeader") return rec.teamLeaderUserId ? getUName(rec.teamLeaderUserId) : "Needs Assignment";
    if(rec.stage==="Sponsor" || rec.stage==="OngoingCare") return rec.sponsorUserId ? getUName(rec.sponsorUserId) : "Needs Assignment";
    return "Complete";
  };
  const getLast = rec => rec && rec.contacts.length>0 ? rec.contacts[rec.contacts.length-1] : null;
  const activeUsers = users.filter(u=>u.status==="Active"&&!u.superAdmin);

  // OngoingCare stats
  const ongoingRecords = visitRecords.filter(r=>r.stage==="OngoingCare");
  const overdueRecords = ongoingRecords.filter(r=>{const s=careStatus(r);return s && s.label==="Overdue";});
  const dueSoonRecords = ongoingRecords.filter(r=>{const s=careStatus(r);return s && (s.label==="Due Today" || s.label==="Due Soon");});

  const submitLog = () => {
    const rec = logModal;
    if(!logForm.method||!logForm.date){alert("Method and date required.");return;}
    const contact = {id:Date.now(),method:logForm.method,date:logForm.date,notes:logForm.notes,completed:logForm.completed,stage:rec.stage};
    const newContacts = [...rec.contacts,contact];
    if(logForm.completed) {
      if(rec.stage==="Pastor") {
        const upd = {...rec,contacts:newContacts,stage:"TeamLeader"};
        setVisitRecords(rs=>rs.map(r=>r.id===rec.id?upd:r));
        setLogModal(null); setAssignModal({rec:upd,type:"TeamLeader"}); setAssignUid("");
      } else if(rec.stage==="TeamLeader") {
        const upd = {...rec,contacts:newContacts,stage:"Sponsor"};
        setVisitRecords(rs=>rs.map(r=>r.id===rec.id?upd:r));
        setLogModal(null); setAssignModal({rec:upd,type:"Sponsor"}); setAssignUid("");
      } else if(rec.stage==="Sponsor") {
        // Initial sponsor visit complete → enter OngoingCare cycle
        setVisitRecords(rs=>rs.map(r=>r.id===rec.id?{...r,contacts:newContacts,stage:"OngoingCare",ongoingStartDate:td(),sponsorInitialDate:td()}:r));
        setLogModal(null);
      } else if(rec.stage==="OngoingCare") {
        // Each completed ongoing contact resets the 14-day cycle (via getNextDue)
        setVisitRecords(rs=>rs.map(r=>r.id===rec.id?{...r,contacts:newContacts}:r));
        setLogModal(null);
      }
    } else {
      setVisitRecords(rs=>rs.map(r=>r.id===rec.id?{...r,contacts:newContacts}:r));
      setLogModal(null);
    }
    setLogForm({method:"Call",date:td(),notes:"",completed:false});
  };

  const submitAssign = () => {
    if(!assignUid){alert("Please select a user.");return;}
    const id = assignModal.rec.id;
    const type = assignModal.type;
    setVisitRecords(rs=>rs.map(r=>{
      if(r.id!==id) return r;
      return type==="TeamLeader" ? {...r,teamLeaderUserId:+assignUid} : {...r,sponsorUserId:+assignUid};
    }));
    setAssignModal(null); setAssignUid("");
  };

  // Manually stop ongoing care (e.g., when visitor becomes member — happens automatically too via People page)
  const stopOngoing = recId => {
    if(!confirm("Stop ongoing care? Record will be marked Complete.")) return;
    setVisitRecords(rs=>rs.map(r=>r.id===recId?{...r,stage:"Complete",completedDate:td()}:r));
  };

  const convertToMember = (rec) => {
    const v = getV(rec.visitorId);
    if(!v) return;
    const careContacts = (rec.contacts||[]).filter(c=>c.stage==="OngoingCare");
    if(!confirm(`Convert ${v.first} ${v.last} to an Active Member?\n\nThis will:\n• Add them to the Members directory as Active\n• Mark their visitation record as Converted\n\nThey have completed ${careContacts.length} ongoing care check-ins.`)) return;
    // Add to members
    const newMemberId = Date.now();
    setMembers(ms=>[...ms,{
      id: newMemberId,
      first: v.first,
      last: v.last,
      phone: v.phone||"",
      email: v.email||"",
      status: "Active",
      role: "Member",
      joined: td(),
      notes: "Converted from Visitation after Ongoing Sponsor Care.",
      family: ""
    }]);
    // Mark visitor record as Converted
    setVisitRecords(rs=>rs.map(r=>r.id===rec.id?{...r,stage:"Converted",completedDate:td(),convertedMemberId:newMemberId}:r));
    // Update visitor stage
    setVisitors(vs=>vs.map(v2=>v2.id===v.id?{...v2,stage:"Member"}:v2));
  };

  const genReport = async () => {
    setAiLoad(true);
    const total = visitRecords.length;
    const done = visitRecords.filter(r=>r.stage==="Complete").length;
    const ongoing = ongoingRecords.length;
    const overdue = overdueRecords.length;
    const rate = total ? Math.round(done/total*100) : 0;
    const byStage = Object.keys(VS).map(k=>VS[k]+": "+visitRecords.filter(r=>r.stage===k).length).join(", ");
    const txt = await callAI([{role:"user",content:"Generate a 3-4 paragraph pastoral visitation report for Pastor Hall. Total: "+total+". By stage: "+byStage+". Currently in Ongoing Sponsor Care: "+ongoing+", of which "+overdue+" are overdue. Initial pipeline completion rate: "+rate+"%. Include a scripture and mention the importance of ongoing sponsor care."}],[],[],[],[],[],{});
    setAiRep(txt); setAiLoad(false);
  };

  // Pipeline columns now include OngoingCare
  const stageList = ["Pastor","TeamLeader","Sponsor","OngoingCare","Complete"];

  return (
    <div>
      {/* Overdue Alert for Pastor Hall */}
      {overdueRecords.length>0 && !careAlertDismissed && (
        <div style={{background:"#fef2f2",border:"1.5px solid "+RE+"55",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:RE+"18",color:RE,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,flexShrink:0}}>!</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:RE}}>Overdue Sponsor Check-Ins</div>
            <div style={{fontSize:12,color:"#7f1d1d",marginTop:2}}>
              {overdueRecords.length} visitor{overdueRecords.length!==1?"s":""} ha{overdueRecords.length!==1?"ve":"s"} missed their 14-day sponsor check-in.
              <button onClick={()=>setTab("ongoing")} style={{background:"none",border:"none",color:RE,cursor:"pointer",fontWeight:500,textDecoration:"underline",padding:0,marginLeft:6,fontSize:12}}>View now</button>
            </div>
          </div>
          <button onClick={()=>setCareAlertDismissed(true)} style={{background:"none",border:"none",cursor:"pointer",color:MU,fontSize:16}}>x</button>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
        <div style={{flex:1,display:"flex",background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
          {[["pipeline","Pipeline"],["ongoing","Ongoing Care"],["tracker","Visitor Tracker"],["reports","Reports"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===id?G:"transparent"),background:tab===id?"#f8f9fc":W,fontSize:13,fontWeight:tab===id?500:400,color:tab===id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              {label}
              {id==="ongoing" && overdueRecords.length>0 && <span style={{background:RE,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:600}}>{overdueRecords.length}</span>}
              {id==="ongoing" && overdueRecords.length===0 && ongoingRecords.length>0 && <span style={{background:G,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:500}}>{ongoingRecords.length}</span>}
              {id==="reports" && visitRecords.filter((r:any)=>r.stage==="Complete").length>0 && <span style={{marginLeft:6,background:GR+"22",color:GR,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{visitRecords.filter((r:any)=>r.stage==="Complete").length}</span>}
            </button>
          ))}
        </div>
        <Btn onClick={()=>setView("addperson")} v="gold" style={{flexShrink:0,fontSize:12}}>+ Add Visitor</Btn>
      </div>

      {/* PIPELINE TAB */}
      {tab==="pipeline" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
          {stageList.map(stage=>{
            const recs = visitRecords.filter(r=>r.stage===stage);
            const overdueInCol = stage==="OngoingCare" ? recs.filter(r=>{const s=careStatus(r);return s&&s.label==="Overdue";}).length : 0;
            return (
              <div key={stage}>
                <div style={{padding:"8px 12px",background:VC[stage]+"14",borderRadius:"8px 8px 0 0",border:"0.5px solid "+VC[stage]+"44",borderBottom:"2px solid "+VC[stage],marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:500,color:VC[stage],textTransform:"uppercase",letterSpacing:0.5}}>{VS[stage]}</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                    <div style={{fontSize:22,fontWeight:500,color:VC[stage]}}>{recs.length}</div>
                    {overdueInCol>0 && <span style={{fontSize:10,background:RE,color:"#fff",borderRadius:10,padding:"1px 6px",fontWeight:600}}>{overdueInCol} overdue</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {recs.map(rec=>{
                    const v = getV(rec.visitorId);
                    if(!v) return null;
                    const last = getLast(rec);
                    const needsAssign = (stage==="TeamLeader"&&!rec.teamLeaderUserId)||(stage==="Sponsor"&&!rec.sponsorUserId);
                    const cs = stage==="OngoingCare" ? careStatus(rec) : null;
                    const due = stage==="OngoingCare" ? getNextDue(rec) : null;
                    return (
                      <div key={rec.id} style={{background:W,border:"0.5px solid "+(cs?.label==="Overdue"?RE+"88":needsAssign?"#fca5a5":BR),borderRadius:10,padding:12,borderLeft:cs?.label==="Overdue"?"3px solid "+RE:undefined}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <Av f={v.first} l={v.last} sz={28}/>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.first} {v.last}</div>
                            <div style={{fontSize:11,color:MU}}>{fd(v.firstVisit)}</div>
                          </div>
                        </div>
                        {needsAssign && <div style={{fontSize:11,background:"#fee2e2",color:RE,borderRadius:4,padding:"2px 7px",marginBottom:6,display:"inline-block"}}>Needs Assignment</div>}
                        {cs && (
                          <div style={{fontSize:10,background:cs.bg,color:cs.color,borderRadius:4,padding:"2px 7px",marginBottom:6,display:"inline-flex",alignItems:"center",gap:4,fontWeight:500}}>
                            {cs.label}
                            {cs.label==="Overdue" && " "+cs.days+"d"}
                            {cs.label!=="Overdue" && cs.label!=="Due Today" && " in "+cs.days+"d"}
                          </div>
                        )}
                        {last && (
                          <div style={{fontSize:11,color:MU,marginBottom:6,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                            <span style={{background:(METH_CLR[last.method]||{bg:BG}).bg,color:(METH_CLR[last.method]||{c:MU}).c,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:500}}>{METH_IC[last.method]} {last.method}</span>
                            {fd(last.date)}
                          </div>
                        )}
                        {due && <div style={{fontSize:10,color:cs?.color||MU,marginBottom:6,fontWeight:500}}>Next check-in: {fd(due)}</div>}
                        <div style={{fontSize:11,color:MU,marginBottom:8}}>To: {getAssigned(rec)}</div>
                        {stage!=="Complete" && <Btn onClick={()=>{setLogModal(rec);setLogForm({method:"Call",date:td(),notes:"",completed:false});}} v="ai" style={{fontSize:11,padding:"4px 8px",width:"100%",justifyContent:"center"}}>Log Contact</Btn>}
                        {stage==="Complete" && <div style={{fontSize:11,color:TE,fontWeight:500,textAlign:"center"}}>Fully Complete</div>}
                      </div>
                    );
                  })}
                  {recs.length===0 && <div style={{textAlign:"center",padding:"20px 8px",color:MU,fontSize:12,fontStyle:"italic"}}>None here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ONGOING CARE TAB */}
      {tab==="ongoing" && (
        <div>
          {/* Ready to Convert Alert */}
          {ongoingRecords.filter(r=>(r.contacts||[]).filter(c=>c.stage==="OngoingCare").length>=5).length>0 && (
            <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:GR+"22",color:GR,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,flexShrink:0}}>✓</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:GR}}>Ready to Convert to Member</div>
                <div style={{fontSize:12,color:"#166534",marginTop:2}}>
                  {ongoingRecords.filter(r=>(r.contacts||[]).filter(c=>c.stage==="OngoingCare").length>=5).map(r=>{const v=getV(r.visitorId);return v?v.first+" "+v.last:null;}).filter(Boolean).join(", ")} — completed 5+ ongoing care check-ins and {ongoingRecords.filter(r=>(r.contacts||[]).filter(c=>c.stage==="OngoingCare").length>=5).length===1?"is":"are"} ready to join the church family!
                </div>
              </div>
            </div>
          )}

          <div style={{background:G+"0a",border:"1px solid "+G+"33",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#5f4909",lineHeight:1.6}}>
            <strong style={{color:G}}>Ongoing Sponsor Care</strong> — After Pastor Hall, Team Leader, and Sponsor each complete their initial follow-up, the sponsor enters a recurring <strong>14-day care cycle</strong>. Each completed text/call/visit resets the 14-day timer. Care continues until the visitor is converted to a member.
          </div>

          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            <Stat label="In Ongoing Care" value={ongoingRecords.length} color={G}/>
            <Stat label="Overdue" value={overdueRecords.length} color={RE} sub="Needs immediate contact"/>
            <Stat label="Due Within 3 Days" value={dueSoonRecords.length} color={AM}/>
            <Stat label="On Track" value={ongoingRecords.length-overdueRecords.length-dueSoonRecords.length} color={GR}/>
          </div>

          {ongoingRecords.length===0 ? (
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
              <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>No visitors in ongoing care yet</h3>
              <p style={{fontSize:13,color:MU}}>When a sponsor completes their initial visit, the visitor moves here for 14-day recurring follow-ups.</p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[...ongoingRecords].sort((a,b)=>{
                const sa = careStatus(a), sb = careStatus(b);
                const order = {Overdue:0,"Due Today":1,"Due Soon":2,"On Track":3};
                return (order[sa?.label]||9) - (order[sb?.label]||9);
              }).map(rec=>{
                const v = getV(rec.visitorId);
                if(!v) return null;
                const cs = careStatus(rec);
                const due = getNextDue(rec);
                const careContacts = (rec.contacts||[]).filter(c=>c.stage==="OngoingCare");
                const last = careContacts[careContacts.length-1] || getLast(rec);
                const sponsor = getUName(rec.sponsorUserId);
                return (
                  <div key={rec.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,borderLeft:"4px solid "+(cs?.color||BR)}}>
                    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <Av f={v.first} l={v.last} sz={44}/>
                      <div style={{flex:1,minWidth:180}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                          <span style={{fontSize:15,fontWeight:500,color:N}}>{v.first} {v.last}</span>
                          <span style={{fontSize:11,background:cs.bg,color:cs.color,borderRadius:20,padding:"2px 10px",fontWeight:500}}>
                            {cs.label}{cs.label==="Overdue" && " by "+cs.days+" day"+(cs.days!==1?"s":"")}
                          </span>
                          {careContacts.length>=5 && (
                            <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 10px",fontWeight:600}}>✓ Ready to Convert</span>
                          )}
                        </div>
                        <div style={{fontSize:12,color:MU}}>Sponsor: <strong style={{color:TX}}>{sponsor}</strong> · First visit {fd(v.firstVisit)} · {careContacts.length} ongoing contact{careContacts.length!==1?"s":""} logged</div>
                      </div>
                      <div style={{textAlign:"right",minWidth:120}}>
                        <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>Next Check-In</div>
                        <div style={{fontSize:14,fontWeight:500,color:cs.color}}>{fd(due)}</div>
                        {cs.label!=="Overdue" && cs.label!=="Due Today" && <div style={{fontSize:10,color:MU}}>in {cs.days} day{cs.days!==1?"s":""}</div>}
                      </div>
                    </div>
                    {last && (
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,padding:"7px 12px",background:BG,borderRadius:8,fontSize:12,color:MU,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,fontWeight:500}}>Last Contact</span>
                        <span style={{background:(METH_CLR[last.method]||{bg:W}).bg,color:(METH_CLR[last.method]||{c:MU}).c,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:500}}>{METH_IC[last.method]} {last.method}</span>
                        <span>{fd(last.date)}</span>
                        {last.notes && <span style={{fontStyle:"italic"}}>— "{last.notes.slice(0,60)}{last.notes.length>60?"...":""}"</span>}
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                      <Btn onClick={()=>{setLogModal(rec);setLogForm({method:"Call",date:td(),notes:"",completed:true});}} v="ai">Log Check-In</Btn>
                      {v.phone && <a href={"tel:"+v.phone} style={{textDecoration:"none"}}><Btn v="ghost" style={{fontSize:12}}>Call</Btn></a>}
                      {v.phone && <a href={"sms:"+v.phone} style={{textDecoration:"none"}}><Btn v="ghost" style={{fontSize:12}}>Text</Btn></a>}
                      <div style={{flex:1}}></div>
                      {careContacts.length>=5 && (
                        <Btn onClick={()=>convertToMember(rec)} v="gold" style={{fontSize:12,fontWeight:600}}>Convert to Member</Btn>
                      )}
                      <Btn onClick={()=>stopOngoing(rec.id)} v="ghost" style={{fontSize:12}}>Mark Complete</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISITOR TRACKER TAB */}
      {tab==="tracker" && (
        <div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden",marginBottom:14}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f8f9fc"}}>
                  {["Visitor","First Visit","Stage","Assigned To","Contacts","Last Contact","Status","Actions"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitors.map(v=>{
                  const rec = getRec(v.id);
                  if(!rec) return null;
                  const last = getLast(rec);
                  const cs = rec.stage==="OngoingCare" ? careStatus(rec) : null;
                  return (
                    <tr key={v.id} style={{borderBottom:"0.5px solid "+BR}}>
                      <td style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <Av f={v.first} l={v.last} sz={28}/>
                          <span style={{fontSize:13,fontWeight:500}}>{v.first} {v.last}</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 14px",fontSize:12,color:MU}}>{fd(v.firstVisit)}</td>
                      <td style={{padding:"10px 14px"}}>
                        <span style={{background:VC[rec.stage]+"18",color:VC[rec.stage],borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{VS[rec.stage]}</span>
                      </td>
                      <td style={{padding:"10px 14px",fontSize:12}}>{getAssigned(rec)}</td>
                      <td style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:N}}>{rec.contacts.length}</td>
                      <td style={{padding:"10px 14px"}}>
                        {last
                          ? <span style={{background:(METH_CLR[last.method]||{bg:BG}).bg,color:(METH_CLR[last.method]||{c:MU}).c,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:500}}>{METH_IC[last.method]} {last.method}</span>
                          : <span style={{color:MU,fontSize:12}}>None yet</span>
                        }
                      </td>
                      <td style={{padding:"10px 14px"}}>
                        {cs ? <span style={{background:cs.bg,color:cs.color,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:500}}>{cs.label}</span>
                        : rec.stage==="Complete"
                          ? <span style={{background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:500}}>Complete</span>
                          : <span style={{background:"#fef9c3",color:"#854d0e",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:500}}>In Progress</span>
                        }
                      </td>
                      <td style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",gap:6}}>
                          {rec.stage!=="Complete" && <Btn onClick={()=>{setLogModal(rec);setLogForm({method:"Call",date:td(),notes:"",completed:false});}} v="ai" style={{fontSize:11,padding:"4px 8px"}}>Log</Btn>}
                          <Btn onClick={()=>setExpandedId(expandedId===v.id?null:v.id)} v="ghost" style={{fontSize:11,padding:"4px 8px"}}>{expandedId===v.id?"Hide":"History"}</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {expandedId && (()=>{
            const v = visitors.find(x=>x.id===expandedId);
            const rec = getRec(expandedId);
            if(!v||!rec) return null;
            return (
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
                <div style={{fontSize:14,fontWeight:500,color:N,marginBottom:14}}>Contact History — {v.first} {v.last}</div>
                {rec.contacts.length===0
                  ? <p style={{color:MU,fontSize:13,fontStyle:"italic",margin:0}}>No contacts logged yet.</p>
                  : (
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {rec.contacts.map((c,i)=>(
                        <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",paddingBottom:12,borderBottom:i<rec.contacts.length-1?"0.5px solid "+BR:"none"}}>
                          <div style={{width:36,height:36,borderRadius:"50%",background:(METH_CLR[c.method]||{bg:BG}).bg,color:(METH_CLR[c.method]||{c:MU}).c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{METH_IC[c.method]}</div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
                              <span style={{fontSize:13,fontWeight:500}}>{c.method}</span>
                              <span style={{fontSize:12,color:MU}}>{fd(c.date)}</span>
                              {c.stage && <span style={{fontSize:10,background:VC[c.stage]+"18",color:VC[c.stage],borderRadius:4,padding:"1px 6px",fontWeight:500}}>{VS[c.stage]}</span>}
                              {c.completed && <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:4,padding:"1px 6px"}}>Completed</span>}
                            </div>
                            {c.notes && <div style={{fontSize:12,color:MU}}>{c.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            );
          })()}
        </div>
      )}

      {/* REPORTS TAB */}
      {tab==="reports" && (
        <div>
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
            <Stat label="Total Tracked" value={visitRecords.length}/>
            <Stat label="Pastor Visit" value={visitRecords.filter(r=>r.stage==="Pastor").length} color={N}/>
            <Stat label="Team Leader" value={visitRecords.filter(r=>r.stage==="TeamLeader").length} color={PU}/>
            <Stat label="Sponsor" value={visitRecords.filter(r=>r.stage==="Sponsor").length} color={GR}/>
            <Stat label="Ongoing Care" value={ongoingRecords.length} color={G}/>
            <Stat label="Completed" value={visitRecords.filter(r=>r.stage==="Complete").length} color={TE}/>
            <Stat label="Initial Completion" value={visitRecords.length ? Math.round((visitRecords.filter(r=>r.stage==="OngoingCare"||r.stage==="Complete").length)/visitRecords.length*100)+"%" : "0%"} color={GR}/>
          </div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>AI Visitation Report</h3>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={genReport} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{aiLoad?"Generating...":"Generate Report"}</Btn>
                {aiRep && <Btn onClick={()=>navigator.clipboard.writeText(aiRep)} v="ghost" style={{fontSize:12,padding:"5px 10px"}}>Copy</Btn>}
              </div>
            </div>
            <div style={{fontSize:13,lineHeight:1.9,color:aiRep?TX:MU,fontStyle:aiRep?"normal":"italic",whiteSpace:"pre-wrap"}}>{aiRep||"Click Generate Report for an AI-powered pastoral visitation narrative, Pastor Hall."}</div>
          </div>
          <h3 style={{fontSize:14,fontWeight:500,color:N,marginBottom:14}}>Detailed Visitor Timeline</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {visitors.map(v=>{
              const rec = getRec(v.id);
              if(!rec) return null;
              const isOpen = expandedId===v.id;
              const cs = rec.stage==="OngoingCare" ? careStatus(rec) : null;
              return (
                <div key={v.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedId(isOpen?null:v.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
                    <Av f={v.first} l={v.last} sz={34}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500}}>{v.first} {v.last}</div>
                      <div style={{fontSize:11,color:MU}}>First visit: {fd(v.firstVisit)} - {rec.contacts.length} contact{rec.contacts.length!==1?"s":""} logged</div>
                    </div>
                    {cs && <span style={{background:cs.bg,color:cs.color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:500}}>{cs.label}</span>}
                    <span style={{background:VC[rec.stage]+"18",color:VC[rec.stage],borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:500}}>{VS[rec.stage]}</span>
                    <span style={{color:MU,fontSize:14}}>{isOpen?"^":"v"}</span>
                  </div>
                  {isOpen && (
                    <div style={{borderTop:"0.5px solid "+BR,padding:16}}>
                      {rec.contacts.length===0
                        ? <p style={{color:MU,fontSize:13,fontStyle:"italic",margin:0}}>No contacts logged yet.</p>
                        : (
                          <div style={{display:"flex",flexDirection:"column",gap:10}}>
                            {rec.contacts.map((c,i)=>(
                              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",paddingBottom:10,borderBottom:i<rec.contacts.length-1?"0.5px solid "+BR:"none"}}>
                                <div style={{width:32,height:32,borderRadius:"50%",background:(METH_CLR[c.method]||{bg:BG}).bg,color:(METH_CLR[c.method]||{c:MU}).c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{METH_IC[c.method]}</div>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:2}}>
                                    <span style={{fontSize:13,fontWeight:500}}>{c.method}</span>
                                    <span style={{fontSize:11,color:MU}}>{fd(c.date)}</span>
                                    {c.stage && <span style={{fontSize:10,background:VC[c.stage]+"18",color:VC[c.stage],borderRadius:4,padding:"1px 6px",fontWeight:500}}>{VS[c.stage]}</span>}
                                    {c.completed && <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:4,padding:"1px 6px"}}>Step Completed</span>}
                                  </div>
                                  {c.notes && <div style={{fontSize:12,color:MU}}>{c.notes}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={!!logModal} onClose={()=>setLogModal(null)} title="Log Contact" width={440}>
        {logModal && (()=>{
          const v = getV(logModal.visitorId);
          const isOngoing = logModal.stage==="OngoingCare";
          return (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"10px 14px",background:BG,borderRadius:8}}>
                <Av f={v?.first||""} l={v?.last||""} sz={36}/>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>{v?.first} {v?.last}</div>
                  <div style={{fontSize:12,color:MU}}>Stage: <span style={{color:VC[logModal.stage],fontWeight:500}}>{VS[logModal.stage]}</span></div>
                </div>
              </div>
              <Fld label="Contact Method *">
                <div style={{display:"flex",gap:8}}>
                  {["Text","Call","Visit"].map(mth=>(
                    <button key={mth} onClick={()=>setLogForm(f=>({...f,method:mth}))} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"0.5px solid "+(logForm.method===mth?N:BR),background:logForm.method===mth?N:W,color:logForm.method===mth?"#fff":TX,fontSize:13,cursor:"pointer",fontWeight:logForm.method===mth?500:400}}>
                      {METH_IC[mth]} {mth}
                    </button>
                  ))}
                </div>
              </Fld>
              <Fld label="Date *"><Inp type="date" value={logForm.date} onChange={v=>setLogForm(f=>({...f,date:v}))}/></Fld>
              <Fld label="Notes"><Inp value={logForm.notes} onChange={v=>setLogForm(f=>({...f,notes:v}))} placeholder="Notes from this contact..."/></Fld>
              <div onClick={()=>setLogForm(f=>({...f,completed:!f.completed}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:logForm.completed?"#f0fdf4":BG,border:"0.5px solid "+(logForm.completed?GR+"66":BR),borderRadius:8,cursor:"pointer",marginBottom:14}}>
                <div style={{width:20,height:20,borderRadius:4,border:"1.5px solid "+(logForm.completed?GR:BR),background:logForm.completed?GR:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {logForm.completed && <span style={{color:"#fff",fontSize:12,lineHeight:1}}>v</span>}
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:logForm.completed?GR:TX}}>Mark this contact as completed</div>
                  <div style={{fontSize:11,color:MU}}>
                    {logModal.stage==="Pastor" ? "Will advance to Team Leader" :
                     logModal.stage==="TeamLeader" ? "Will advance to Sponsor" :
                     logModal.stage==="Sponsor" ? "Will start 14-day Ongoing Care cycle" :
                     isOngoing ? "Will reset the 14-day check-in timer" : ""}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={submitLog} style={{flex:1,justifyContent:"center"}}>Save Contact Log</Btn>
                <Btn onClick={()=>setLogModal(null)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!assignModal} onClose={()=>setAssignModal(null)} title={assignModal?"Assign "+(assignModal.type==="TeamLeader"?"Team Leader":"Sponsor"):""} width={420}>
        {assignModal && (()=>{
          const v = getV(assignModal.rec.visitorId);
          const isTL = assignModal.type==="TeamLeader";
          return (
            <div>
              <div style={{background:GL,border:"0.5px solid "+G,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#7a5c10",lineHeight:1.6}}>
                {isTL?"Pastor Hall completed the first visit for ":"The Team Leader completed follow-up for "}
                <strong>{v?.first} {v?.last}</strong>. Assign a {isTL?"Team Leader":"Sponsor"} to continue.
              </div>
              <Fld label={"Select "+(isTL?"Team Leader":"Sponsor")+" *"}>
                <select value={assignUid} onChange={e=>setAssignUid(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
                  <option value="">Select a user</option>
                  {activeUsers.map(u=>{
                    const m = members.find(x=>x.id===u.memberId);
                    return m ? <option key={u.id} value={u.id}>{m.first} {m.last}{m.role?" ("+m.role+")":""}</option> : null;
                  })}
                </select>
              </Fld>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={submitAssign} style={{flex:1,justifyContent:"center"}}>Assign and Continue</Btn>
                <Btn onClick={()=>setAssignModal(null)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ── GROUPS MINISTRY ──
function Groups({members,groups,setGroups,grpMeetings,setGrpMeetings}) {
  const [tab,setTab]=useState("groups");
  const [modal,setModal]=useState(false);
  const [editG,setEditG]=useState(null);
  const [selId,setSelId]=useState(groups[0]?.id||null);
  const [form,setForm]=useState({name:"",type:"Bible Study",description:"",color:GROUP_COLORS[0],day:"Wednesday",time:"7:00 PM",location:"",leaderId:""});
  const [logModal,setLogModal]=useState(false);
  const [checked,setChecked]=useState(new Set());
  const [logForm,setLogForm]=useState({date:td(),walkIns:0,notes:""});
  const [expandedId,setExpandedId]=useState(null);
  const [aiSum,setAiSum]=useState("");const[aiSumLoad,setAiSumLoad]=useState(false);
  const [bulkMsg,setBulkMsg]=useState("");const[bulkLoad,setBulkLoad]=useState(false);
  const [indivMsgs,setIndivMsgs]=useState({});const[indivLoad,setIndivLoad]=useState({});
  const [msgMode,setMsgMode]=useState("bulk");
  const [msgLog,setMsgLog]=useState([]);
  const nid=useRef(800);
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const group=groups.find(g=>g.id===selId);
  const enrolled=group?members.filter(m=>group.memberIds.includes(m.id)):[];
  const grpMeets=group?[...grpMeetings].filter(m=>m.groupId===selId).sort((a,b)=>b.date.localeCompare(a.date)):[];
  const leader=group?members.find(m=>m.id===group.leaderId):null;

  const openAdd=()=>{setEditG(null);setForm({name:"",type:"Bible Study",description:"",color:GROUP_COLORS[0],day:"Wednesday",time:"7:00 PM",location:"",leaderId:""});setModal(true);};
  const openEdit=g=>{setEditG(g);setForm({name:g.name,type:g.type,description:g.description,color:g.color,day:g.day,time:g.time,location:g.location,leaderId:g.leaderId||""});setModal(true);};
  const saveGroup=()=>{
    if(!form.name.trim()){alert("Group name required.");return;}
    if(editG)setGroups(gs=>gs.map(g=>g.id===editG.id?{...g,...form,leaderId:+form.leaderId||null}:g));
    else setGroups(gs=>[...gs,{...form,id:nid.current++,leaderId:+form.leaderId||null,memberIds:[],created:td()}]);
    setModal(false);
  };
  const delGroup=id=>{if(confirm("Delete this group?"))setGroups(gs=>gs.filter(g=>g.id!==id));};
  const addMember=mid=>setGroups(gs=>gs.map(g=>g.id===selId?{...g,memberIds:[...g.memberIds,mid]}:g));
  const removeMember=mid=>setGroups(gs=>gs.map(g=>g.id===selId?{...g,memberIds:g.memberIds.filter(id=>id!==mid)}:g));
  const togglePresent=id=>{const nc=new Set(checked);nc.has(id)?nc.delete(id):nc.add(id);setChecked(nc);};
  const openLog=()=>{setChecked(new Set());setLogForm({date:td(),walkIns:0,notes:""});setLogModal(true);};
  const saveMeet=()=>{
    const absent=enrolled.map(m=>m.id).filter(id=>!checked.has(id));
    setGrpMeetings(ms=>[...ms,{id:nid.current++,groupId:selId,date:logForm.date,presentIds:[...checked],absentIds:absent,walkIns:+logForm.walkIns||0,notes:logForm.notes,total:checked.size+(+logForm.walkIns||0)}]);
    setLogModal(false);
  };
  const genAiSum=async()=>{
    if(!group)return;setAiSumLoad(true);
    const avg=grpMeets.length?Math.round(grpMeets.reduce((a,m)=>a+m.presentIds.length,0)/grpMeets.length):0;
    const faithful=enrolled.filter(m=>grpMeets.filter(mt=>mt.presentIds.includes(m.id)).length>=Math.ceil(grpMeets.length*0.75));
    const needFU=enrolled.filter(m=>grpMeets.slice(0,3).every(mt=>mt.absentIds.includes(m.id)));
    const txt=await callAI("Write a warm 2-3 paragraph pastoral attendance summary for Pastor Hall about the group '"+group.name+"'. Total meetings: "+grpMeets.length+". Avg attendance: "+avg+" of "+enrolled.length+". Faithful members: "+faithful.map(m=>m.first+" "+m.last).join(", ")+". Needing follow-up: "+(needFU.map(m=>m.first+" "+m.last).join(", ")||"none")+". Include scripture encouragement.",[],[],[],[],[],{});
    setAiSum(txt);setAiSumLoad(false);
  };
  const genBulk=async()=>{
    if(!group)return;setBulkLoad(true);
    const lastMeet=grpMeets[0];
    const txt=await callAI("Write a warm encouraging group text message (2-3 sentences) from Pastor Hall to the "+group.name+" group at NTCC. "+(lastMeet?"Last meeting was "+fd(lastMeet.date)+". ":"")+"Invite them to the next meeting on "+group.day+" at "+group.time+(group.location?" at "+group.location:"")+". Include a faith-filled word. Brief and conversational for SMS. Output only the message.",[],[],[],[],[],{});
    setBulkMsg(txt);setBulkLoad(false);
  };
  const genIndiv=async(m)=>{
    setIndivLoad(l=>({...l,[m.id]:true}));
    const attended=grpMeets.filter(mt=>mt.presentIds.includes(m.id)).length;
    const rate=grpMeets.length?Math.round(attended/grpMeets.length*100):0;
    const txt=await callAI("Write a warm personal text (2-3 sentences) from Pastor Hall to "+m.first+" "+m.last+", member of the "+group.name+" group at NTCC. Attendance: "+rate+"%. "+(rate<50?"They have been absent — encourage them warmly to return.":"They are faithful — affirm and encourage them.")+" Output only the message, no labels.",[],[],[],[],[],{});
    setIndivMsgs(prev=>({...prev,[m.id]:txt}));setIndivLoad(l=>({...l,[m.id]:false}));
  };
  const attRate=m=>enrolled.length?Math.round(m.presentIds.length/enrolled.length*100):0;
  const pColor=r=>r>=75?GR:r>=50?AM:RE;
  const avail=group?members.filter(m=>!group.memberIds.includes(m.id)):[];
  const TABS=[["groups","Groups"],["roster","Roster"],["attendance","Attendance"],["messaging","Messaging"]];

  return(
    <div>
      <div style={{display:"flex",marginBottom:20,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===id?G:"transparent"),background:tab===id?"#f8f9fc":W,fontSize:13,fontWeight:tab===id?500:400,color:tab===id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            {label}
            {id==="groups"&&<span style={{background:N+"22",color:N,borderRadius:10,fontSize:10,padding:"1px 6px"}}>{groups.length}</span>}
          </button>
        ))}
      </div>

      {/* GROUPS */}
      {tab==="groups"&&(
        <div>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <Stat label="Total Groups" value={groups.length}/>
            <Stat label="Members Enrolled" value={[...new Set(groups.flatMap(g=>g.memberIds))].length} color={BL}/>
            <Stat label="Meetings This Month" value={grpMeetings.filter(m=>m.date.startsWith("2026-04")).length} color={GR}/>
            <Stat label="Active Leaders" value={groups.filter(g=>g.leaderId).length} color={G}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}><Btn onClick={openAdd}>+ Create Group</Btn></div>
          {groups.length===0&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center",color:MU}}>No groups yet. Click "+ Create Group" to get started.</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {groups.map(g=>{
              const ldr=members.find(m=>m.id===g.leaderId);
              const gm=grpMeetings.filter(m=>m.groupId===g.id);
              const avg=gm.length?Math.round(gm.reduce((a,m)=>a+m.presentIds.length,0)/gm.length):0;
              const last=[...gm].sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||null;
              return(
                <div key={g.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                  <div style={{background:g.color,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div><div style={{color:"#fff",fontWeight:500,fontSize:15,marginBottom:4}}>{g.name}</div><span style={{background:"#ffffff30",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{g.type}</span></div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{setSelId(g.id);openEdit(g);}} style={{background:"#ffffff25",border:"none",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#fff",fontSize:11}}>Edit</button>
                        <button onClick={()=>delGroup(g.id)} style={{background:"#ffffff25",border:"none",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#fff",fontSize:11}}>X</button>
                      </div>
                    </div>
                  </div>
                  <div style={{padding:16,flex:1}}>
                    {g.description&&<div style={{fontSize:12,color:MU,marginBottom:10,lineHeight:1.5}}>{g.description}</div>}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                      {[["Meeting",g.day+" "+g.time],["Location",g.location||"TBD"],["Members",g.memberIds.length+" enrolled"],["Avg Att.",avg+" per meeting"]].map(([k,v])=>(
                        <div key={k} style={{background:BG,borderRadius:6,padding:"5px 8px"}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4}}>{k}</div><div style={{fontSize:12,fontWeight:500,marginTop:1}}>{v}</div></div>
                      ))}
                    </div>
                    {ldr&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:g.color+"12",borderRadius:8}}>
                      <Av f={ldr.first} l={ldr.last} sz={24}/><div><div style={{fontSize:10,color:MU}}>Leader</div><div style={{fontSize:12,fontWeight:500}}>{ldr.first} {ldr.last}</div></div>
                      {last&&<div style={{marginLeft:"auto",fontSize:10,color:MU}}>Last: {fd(last)}</div>}
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROSTER */}
      {tab==="roster"&&(
        <div>
          <div style={{marginBottom:16}}><div style={{fontSize:12,color:MU,marginBottom:8}}>Select a group to manage its roster:</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{groups.map(g=><button key={g.id} onClick={()=>setSelId(g.id)} style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:selId===g.id?500:400,border:"1.5px solid "+(selId===g.id?g.color:BR),background:selId===g.id?g.color+"14":W,color:selId===g.id?g.color:TX,display:"flex",alignItems:"center",gap:7}}><div style={{width:9,height:9,borderRadius:"50%",background:g.color}}></div>{g.name}<span style={{fontSize:10,background:g.color+"22",color:g.color,borderRadius:10,padding:"1px 6px"}}>{g.memberIds.length}</span></button>)}</div></div>
          {!group&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU}}>Select a group above to manage its roster.</div>}
          {group&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid "+BR,background:group.color+"0a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:500,color:group.color}}>{group.name} — Enrolled</div><div style={{fontSize:11,color:MU}}>{enrolled.length} member{enrolled.length!==1?"s":""}</div></div>
                  {leader&&<div style={{display:"flex",alignItems:"center",gap:6}}><Av f={leader.first} l={leader.last} sz={22}/><span style={{fontSize:11,color:MU}}>Leader: {leader.first}</span></div>}
                </div>
                {enrolled.length===0?<div style={{padding:32,textAlign:"center",color:MU,fontSize:13}}>No members yet.</div>:enrolled.map(m=>(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"0.5px solid "+BR}}>
                    <Av f={m.first} l={m.last} sz={32}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{m.role||"Member"} · {m.phone}</div></div>
                    {m.id===group.leaderId&&<span style={{fontSize:10,background:group.color+"22",color:group.color,borderRadius:10,padding:"2px 8px",fontWeight:500}}>Leader</span>}
                    <button onClick={()=>removeMember(m.id)} style={{background:"#fee2e2",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:RE,fontSize:11}}>Remove</button>
                  </div>
                ))}
              </div>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid "+BR,background:"#f8f9fc"}}><div style={{fontSize:13,fontWeight:500}}>Available Members</div><div style={{fontSize:11,color:MU}}>{avail.length} available to add</div></div>
                {avail.length===0?<div style={{padding:32,textAlign:"center",color:MU,fontSize:13}}>All members are enrolled.</div>:avail.map(m=>(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"0.5px solid "+BR}}>
                    <Av f={m.first} l={m.last} sz={32}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{m.role||"Member"} · {m.phone}</div></div>
                    <button onClick={()=>addMember(m.id)} style={{background:"#dcfce7",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:GR,fontSize:11,fontWeight:500}}>+ Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ATTENDANCE */}
      {tab==="attendance"&&(
        <div>
          <div style={{marginBottom:16}}><div style={{fontSize:12,color:MU,marginBottom:8}}>Select a group:</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{groups.map(g=><button key={g.id} onClick={()=>{setSelId(g.id);setAiSum("");}} style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:selId===g.id?500:400,border:"1.5px solid "+(selId===g.id?g.color:BR),background:selId===g.id?g.color+"14":W,color:selId===g.id?g.color:TX,display:"flex",alignItems:"center",gap:7}}><div style={{width:9,height:9,borderRadius:"50%",background:g.color}}></div>{g.name}</button>)}</div></div>
          {!group&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU}}>Select a group above.</div>}
          {group&&(
            <div>
              <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                <Stat label="Meetings" value={grpMeets.length}/><Stat label="Avg Attendance" value={grpMeets.length?Math.round(grpMeets.reduce((a,m)=>a+m.presentIds.length,0)/grpMeets.length):0} color={BL}/><Stat label="Members" value={enrolled.length} color={group.color}/><Stat label="Last Meeting" value={grpMeets[0]?fd(grpMeets[0].date):"None"} color={MU}/>
              </div>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:N}}>✦ AI Attendance Summary</div>
                  <div style={{display:"flex",gap:8}}><Btn onClick={genAiSum} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{aiSumLoad?"Generating...":"Generate Summary"}</Btn>{aiSum&&<Btn onClick={()=>navigator.clipboard.writeText(aiSum)} v="ghost" style={{fontSize:12,padding:"5px 10px"}}>Copy</Btn>}</div>
                </div>
                <div style={{fontSize:13,lineHeight:1.8,color:aiSum?TX:MU,fontStyle:aiSum?"normal":"italic",whiteSpace:"pre-wrap"}}>{aiSum||"Click Generate Summary for an AI-powered pastoral attendance report for this group, Pastor Hall."}</div>
              </div>
              <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:500,color:N,marginBottom:12}}>Member Attendance Overview</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
                  {enrolled.map(m=>{const att=grpMeets.filter(mt=>mt.presentIds.includes(m.id)).length;const rate=grpMeets.length?Math.round(att/grpMeets.length*100):0;return(
                    <div key={m.id} style={{background:BG,borderRadius:8,padding:10,border:"0.5px solid "+BR}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Av f={m.first} l={m.last} sz={26}/><div><div style={{fontSize:12,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:10,color:MU}}>{att}/{grpMeets.length} meetings</div></div></div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:5,background:BR,borderRadius:3,overflow:"hidden"}}><div style={{width:rate+"%",height:"100%",background:pColor(rate),borderRadius:3}}></div></div><span style={{fontSize:11,fontWeight:500,color:pColor(rate),minWidth:30}}>{rate}%</span></div>
                    </div>
                  );})}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:500,color:N}}>Meeting History</div><Btn onClick={openLog}>+ Log Meeting</Btn></div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {grpMeets.length===0&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:32,textAlign:"center",color:MU,fontSize:13}}>No meetings logged yet.</div>}
                {grpMeets.map(mt=>{const rate=attRate(mt);const isOpen=expandedId===mt.id;return(
                  <div key={mt.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
                    <div onClick={()=>setExpandedId(isOpen?null:mt.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
                      <div style={{width:44,height:44,borderRadius:8,background:group.color+"14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{fontSize:16,fontWeight:700,color:group.color,lineHeight:1}}>{mt.presentIds.length+mt.walkIns}</div><div style={{fontSize:9,color:MU}}>present</div></div>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{fd(mt.date)} — {group.name}</div><div style={{fontSize:11,color:MU}}>{mt.presentIds.length} members · {mt.walkIns} walk-ins · {mt.absentIds.length} absent</div></div>
                      <div style={{textAlign:"right",marginRight:8}}><div style={{fontSize:14,fontWeight:500,color:pColor(rate)}}>{rate}%</div><div style={{fontSize:10,color:MU}}>attendance</div></div>
                      <span style={{color:MU,fontSize:12}}>{isOpen?"▲":"▼"}</span>
                    </div>
                    {isOpen&&<div style={{borderTop:"0.5px solid "+BR,padding:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:mt.notes?10:0}}>
                        <div><div style={{fontSize:11,color:GR,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Present ({mt.presentIds.length})</div>{mt.presentIds.map(id=>{const m=members.find(x=>x.id===id);return m?<div key={id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Av f={m.first} l={m.last} sz={20}/><span style={{fontSize:12}}>{m.first} {m.last}</span></div>:null;})}{mt.walkIns>0&&<div style={{fontSize:12,color:MU,marginTop:4}}>+{mt.walkIns} walk-in{mt.walkIns!==1?"s":""}</div>}</div>
                        <div><div style={{fontSize:11,color:RE,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Absent ({mt.absentIds.length})</div>{mt.absentIds.map(id=>{const m=members.find(x=>x.id===id);return m?<div key={id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Av f={m.first} l={m.last} sz={20}/><span style={{fontSize:12,color:MU}}>{m.first} {m.last}</span></div>:null;})}  {mt.absentIds.length===0&&<div style={{fontSize:12,color:MU,fontStyle:"italic"}}>Everyone present!</div>}</div>
                      </div>
                      {mt.notes&&<div style={{background:BG,borderRadius:8,padding:"8px 12px",fontSize:12}}><strong>Notes:</strong> {mt.notes}</div>}
                    </div>}
                  </div>
                );})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MESSAGING */}
      {tab==="messaging"&&(
        <div>
          <div style={{marginBottom:16}}><div style={{fontSize:12,color:MU,marginBottom:8}}>Select a group:</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{groups.map(g=><button key={g.id} onClick={()=>{setSelId(g.id);setBulkMsg("");setIndivMsgs({});}} style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:selId===g.id?500:400,border:"1.5px solid "+(selId===g.id?g.color:BR),background:selId===g.id?g.color+"14":W,color:selId===g.id?g.color:TX,display:"flex",alignItems:"center",gap:7}}><div style={{width:9,height:9,borderRadius:"50%",background:g.color}}></div>{g.name}</button>)}</div></div>
          {!group&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU}}>Select a group above to send messages.</div>}
          {group&&(
            <div>
              <div style={{display:"flex",marginBottom:16,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
                {[["bulk","Bulk Group Message"],["individual","AI Individual Messages"],["log","Message History"]].map(([id,label])=><button key={id} onClick={()=>setMsgMode(id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(msgMode===id?G:"transparent"),background:msgMode===id?"#f8f9fc":W,fontSize:13,fontWeight:msgMode===id?500:400,color:msgMode===id?N:MU,cursor:"pointer"}}>{label}</button>)}
              </div>
              {msgMode==="bulk"&&(
                <div>
                  <div style={{background:GL,border:"0.5px solid "+G,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#7a5c10"}}>Sending to <strong>{enrolled.length} member{enrolled.length!==1?"s":""}</strong>: {enrolled.map(m=>m.first).join(", ")}</div>
                  <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:500,color:N}}>✦ AI-Generated Group Message</div><Btn onClick={genBulk} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{bulkLoad?"Generating...":"Generate Message"}</Btn></div>
                    <textarea value={bulkMsg} onChange={e=>setBulkMsg(e.target.value)} rows={5} placeholder="Your group message will appear here. You can type or edit it directly..." style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
                  </div>
                  {bulkMsg&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                    <Btn onClick={()=>navigator.clipboard.writeText(bulkMsg)} v="gold">Copy Message</Btn>
                    <Btn onClick={()=>{const t=enrolled.map(m=>"To: "+m.first+" "+m.last+" ("+m.phone+")\n"+bulkMsg).join("\n\n---\n\n");navigator.clipboard.writeText(t);alert("All "+enrolled.length+" copies with phone numbers copied!");}} v="outline">Copy All with Numbers</Btn>
                    <Btn onClick={()=>{
                      const recipients = enrolled.filter(m=>m.email).map(m=>({name:m.first+" "+m.last,first:m.first,last:m.last,email:m.email}));
                      if(recipients.length===0){alert("No group members have email addresses on file.");return;}
                      window.__openBulkEmailComposer__ && window.__openBulkEmailComposer__({recipients,subject:group.name+" — A Word from Pastor",body:bulkMsg,category:"Group Message",relatedType:"group"});
                    }} v="primary">Email to Group ({enrolled.filter(m=>m.email).length})</Btn>
                    <Btn onClick={()=>{setMsgLog(ml=>[...ml,{id:nid.current++,groupId:selId,date:td(),type:"bulk",message:bulkMsg,sentTo:enrolled.map(m=>m.first+" "+m.last)}]);alert("Logged as sent to "+enrolled.length+" members.");}} v="success">Log as Sent</Btn>
                  </div>}
                  {bulkMsg&&enrolled.map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:W,border:"0.5px solid "+BR,borderRadius:8,marginBottom:6}}>
                      <Av f={m.first} l={m.last} sz={30}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:BL}}>{m.phone}</div></div>
                      <span style={{fontSize:11,background:"#dcfce7",color:GR,borderRadius:10,padding:"2px 8px",fontWeight:500}}>Ready</span>
                    </div>
                  ))}
                </div>
              )}
              {msgMode==="individual"&&(
                <div>
                  <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:13,fontWeight:500,color:N}}>✦ AI Personalized Messages</div><div style={{fontSize:11,color:MU,marginTop:2}}>Each message is tailored to the member's attendance history</div></div>
                    <Btn onClick={async()=>{for(const m of enrolled)await genIndiv(m);}} v="ai" style={{fontSize:12,padding:"5px 10px"}}>Generate All</Btn>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {enrolled.map(m=>{
                      const att=grpMeets.filter(mt=>mt.presentIds.includes(m.id)).length;
                      const rate=grpMeets.length?Math.round(att/grpMeets.length*100):0;
                      const msg=indivMsgs[m.id];const loading=indivLoad[m.id];
                      return(
                        <div key={m.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:msg?12:0}}>
                            <Av f={m.first} l={m.last} sz={36}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{m.phone} · Attendance: <span style={{color:pColor(rate),fontWeight:500}}>{rate}%</span> ({att}/{grpMeets.length})</div></div>
                            <Btn onClick={()=>genIndiv(m)} v="ai" style={{fontSize:11,padding:"5px 10px"}}>{loading?"Generating...":msg?"Regenerate":"Generate"}</Btn>
                            {msg&&<Btn onClick={()=>navigator.clipboard.writeText("To: "+m.first+" "+m.last+" ("+m.phone+")\n\n"+msg)} v="ghost" style={{fontSize:11,padding:"5px 10px"}}>Copy</Btn>}
                            {msg&&m.email&&<Btn onClick={()=>window.__openEmailComposer__&&window.__openEmailComposer__({to:m.email,toName:m.first+" "+m.last,subject:"A Note from "+(window.__CS__?.pastorName||"Pastor"),body:msg,category:"Group Message",relatedType:"group_individual",relatedId:m.id})} v="primary" style={{fontSize:11,padding:"5px 10px"}}>Email</Btn>}
                          </div>
                          {msg&&<div style={{background:BG,borderRadius:8,padding:"10px 14px",fontSize:13,lineHeight:1.7,borderLeft:"3px solid "+group.color}}>{msg}</div>}
                          {!msg&&!loading&&<div style={{fontSize:12,color:MU,fontStyle:"italic"}}>Click Generate to craft a personalized message for {m.first}.</div>}
                          {loading&&<div style={{fontSize:12,color:MU,fontStyle:"italic"}}>Crafting message for {m.first}...</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {msgMode==="log"&&(
                <div>
                  {msgLog.filter(m=>m.groupId===selId).length===0?<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU,fontSize:13}}>No messages logged yet for this group.</div>:
                  msgLog.filter(m=>m.groupId===selId).sort((a,b)=>b.date.localeCompare(a.date)).map(log=>(
                    <div key={log.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:500}}>{log.type==="bulk"?"Bulk Group Message":"AI Individual Messages"}</span><span style={{fontSize:10,background:log.type==="bulk"?"#eff6ff":"#f3e8ff",color:log.type==="bulk"?BL:PU,borderRadius:10,padding:"2px 8px",fontWeight:500}}>{log.type}</span></div><div style={{fontSize:11,color:MU,marginTop:2}}>{fd(log.date)} · {log.sentTo.length} members</div></div>
                      </div>
                      {log.message&&log.type==="bulk"&&<div style={{background:BG,borderRadius:8,padding:"8px 12px",fontSize:13,lineHeight:1.7,marginBottom:8}}>{log.message}</div>}
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{log.sentTo.map((name,i)=><span key={i} style={{fontSize:11,background:BG,border:"0.5px solid "+BR,borderRadius:4,padding:"2px 7px"}}>{name}</span>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Group Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editG?"Edit Group":"Create New Group"} width={520}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Group Name *"><Inp value={form.name} onChange={sf("name")} placeholder="e.g. Men's Bible Study"/></Fld>
          <Fld label="Group Type"><Slt value={form.type} onChange={sf("type")} opts={GROUP_TYPES}/></Fld>
        </div>
        <Fld label="Description"><Inp value={form.description} onChange={sf("description")} placeholder="Brief description..."/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fld label="Meeting Day"><Slt value={form.day} onChange={sf("day")} opts={DAYS}/></Fld>
          <Fld label="Meeting Time"><Inp value={form.time} onChange={sf("time")} placeholder="7:00 PM"/></Fld>
          <Fld label="Location"><Inp value={form.location} onChange={sf("location")} placeholder="Fellowship Hall"/></Fld>
        </div>
        <Fld label="Group Leader">
          <select value={form.leaderId||""} onChange={e=>sf("leaderId")(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
            <option value="">No leader assigned</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.first} {m.last}{m.role?" ("+m.role+")":""}</option>)}
          </select>
        </Fld>
        <Fld label="Show on Event Calendar">
          <div onClick={()=>sf("showOnCalendar")(!form.showOnCalendar)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:9,border:"0.5px solid "+(form.showOnCalendar?GR+"88":BR),background:form.showOnCalendar?"#f0fdf4":BG,cursor:"pointer",userSelect:"none"}}>
            <div style={{width:40,height:22,borderRadius:11,background:form.showOnCalendar?GR:BR,position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:form.showOnCalendar?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}></div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:form.showOnCalendar?GR:TX}}>{form.showOnCalendar?"Yes — Show on Event Calendar":"No — Keep private to Groups Ministry"}</div>
              <div style={{fontSize:11,color:MU,marginTop:1}}>{form.showOnCalendar?"Group meetings will appear on the calendar for check-in":"Group meetings will not appear on the main calendar"}</div>
            </div>
          </div>
        </Fld>
        <Fld label="Group Color"><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>{GROUP_COLORS.map(c=><div key={c} onClick={()=>sf("color")(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #1f2937":"3px solid transparent",boxSizing:"border-box"}}/>)}</div></Fld>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={saveGroup} style={{flex:1,justifyContent:"center"}}>Save Group</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>

      {/* Log Meeting Modal */}
      <Modal open={logModal} onClose={()=>setLogModal(false)} title={"Log Meeting — "+(group?.name||"")} width={560}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
          <Fld label="Date *"><Inp type="date" value={logForm.date} onChange={v=>setLogForm(f=>({...f,date:v}))}/></Fld>
          <Fld label="Walk-Ins"><Inp type="number" value={logForm.walkIns} onChange={v=>setLogForm(f=>({...f,walkIns:v}))} placeholder="0"/></Fld>
          <Fld label="Notes"><Inp value={logForm.notes} onChange={v=>setLogForm(f=>({...f,notes:v}))} placeholder="Meeting notes..."/></Fld>
        </div>
        <div style={{marginBottom:8,fontSize:12,color:MU}}>Mark attendance:</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setChecked(new Set(enrolled.map(m=>m.id)))} style={{padding:"5px 12px",borderRadius:6,border:"0.5px solid "+BR,background:"#dcfce7",color:GR,fontSize:12,cursor:"pointer",fontWeight:500}}>All Present</button>
          <button onClick={()=>setChecked(new Set())} style={{padding:"5px 12px",borderRadius:6,border:"0.5px solid "+BR,background:"#fee2e2",color:RE,fontSize:12,cursor:"pointer",fontWeight:500}}>All Absent</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
          {enrolled.map(m=>{const present=checked.has(m.id);return(
            <div key={m.id} onClick={()=>togglePresent(m.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"0.5px solid "+(present?GR+"66":RE+"44"),background:present?"#f0fdf4":"#fff5f5",cursor:"pointer",userSelect:"none"}}>
              <div style={{width:20,height:20,borderRadius:4,border:"1.5px solid "+(present?GR:RE),background:present?GR:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:12,lineHeight:1}}>{present?"v":"x"}</span></div>
              <Av f={m.first} l={m.last} sz={26}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{m.role||"Member"}</div></div>
              <span style={{fontSize:11,fontWeight:500,color:present?GR:RE,background:present?"#dcfce7":"#fee2e2",borderRadius:10,padding:"2px 8px"}}>{present?"Present":"Absent"}</span>
            </div>
          );})}
        </div>
        <div style={{background:BG,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}><strong>Total:</strong> {checked.size} members + {logForm.walkIns||0} walk-ins = <strong>{checked.size+(+logForm.walkIns||0)}</strong></div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={saveMeet} style={{flex:1,justifyContent:"center"}}>Save Meeting Log</Btn>
          <Btn onClick={()=>setLogModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── CALENDAR MODULE ──
const INIT_RECURRING=[
  {id:"r1",name:"Sunday Morning Worship",dow:0,time:"11:00 AM",color:N,type:"Worship",location:"Sanctuary"},
  {id:"r2",name:"Education Department",dow:0,time:"11:00 AM",color:G,type:"Education",location:"Education Wing"},
  {id:"r3",name:"Sunday Night Service",dow:0,time:"6:00 PM",color:PU,type:"Worship",location:"Sanctuary"},
  {id:"r4",name:"Tuesday Bible Study",dow:2,time:"7:30 PM",color:GR,type:"Study",location:"Fellowship Hall"},
  {id:"r5",name:"Thursday Worship",dow:4,time:"7:30 PM",color:BL,type:"Worship",location:"Sanctuary"},
];
const CMONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const CDNAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CD2DOW={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};
const CETYPES=["Worship","Education","Study","Prayer","Youth","Outreach","Special","Other"];
const CECOLORS=[N,G,"#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#be185d"];
const CALLERGIES=["Peanuts","Tree Nuts","Dairy/Lactose","Gluten/Wheat","Eggs","Shellfish","Bee Stings","Penicillin","Latex"];
const CMEDICAL=["Asthma","Diabetes","Epilepsy/Seizures","Heart Condition","ADHD","Autism","Sickle Cell","Down Syndrome"];

function calcAge(dob){if(!dob)return "";const t=new Date();const b=new Date(dob+"T00:00:00");let a=t.getFullYear()-b.getFullYear();const m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a>=0?a:"";}
function buildCGrid(yr,mo){const fdow=new Date(yr,mo,1).getDay();const dim=new Date(yr,mo+1,0).getDate();const pmd=new Date(yr,mo,0).getDate();const g=[];for(let i=fdow-1;i>=0;i--){const d=new Date(yr,mo-1,pmd-i);g.push({date:d.toISOString().split("T")[0],cur:false});}for(let i=1;i<=dim;i++){const d=new Date(yr,mo,i);g.push({date:d.toISOString().split("T")[0],cur:true});}let nx=1;while(g.length<42){const d=new Date(yr,mo+1,nx++);g.push({date:d.toISOString().split("T")[0],cur:false});}return g;}
function cEventsFor(dateStr,rec,custom,groups){const dow=new Date(dateStr+"T00:00:00").getDay();const res=[];rec.filter(e=>e.dow===dow).forEach(e=>res.push({...e,date:dateStr,iid:e.id+"_"+dateStr}));custom.filter(e=>e.date===dateStr).forEach(e=>res.push({...e,iid:e.id+"_"+dateStr}));groups.filter(g=>CD2DOW[g.day]===dow).forEach(g=>res.push({id:"g"+g.id,iid:"g"+g.id+"_"+dateStr,name:g.name,time:g.time,color:g.color,type:"Group",location:g.location||"",date:dateStr,isGroup:true}));return res.sort((a,b)=>a.time.localeCompare(b.time));}

function SmlInp({value,onChange,placeholder="",type="text"}){return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{padding:"6px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"}}/>;}

function MedSection({allergies=[],medical=[],medNotes="",onChange,required=false}){
  const tA=item=>{onChange("allergies",allergies.includes(item)?allergies.filter(x=>x!==item):[...allergies,item]);};
  const tM=item=>{onChange("medical",medical.includes(item)?medical.filter(x=>x!==item):[...medical,item]);};
  return(
    <div style={{marginTop:8,paddingTop:8,borderTop:"0.5px solid "+BR}}>
      <div style={{fontSize:10,color:RE,fontWeight:600,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
        Medical and Allergies
        {required?<span style={{background:"#fee2e2",color:RE,borderRadius:4,padding:"1px 6px",fontSize:9}}>Required</span>:<span style={{color:MU,fontWeight:400,fontSize:9}}>(Optional)</span>}
      </div>
      <div style={{marginBottom:5}}><div style={{fontSize:10,color:MU,marginBottom:3,fontWeight:500}}>Allergies:</div><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{CALLERGIES.map(a=>{const on=allergies.includes(a);return <div key={a} onClick={()=>tA(a)} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",userSelect:"none",background:on?"#fee2e2":BG,color:on?RE:MU,border:"0.5px solid "+(on?"#fca5a5":BR),fontWeight:on?500:400}}>{a}</div>;})}</div></div>
      <div style={{marginBottom:5}}><div style={{fontSize:10,color:MU,marginBottom:3,fontWeight:500}}>Medical Conditions:</div><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{CMEDICAL.map(m=>{const on=medical.includes(m);return <div key={m} onClick={()=>tM(m)} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",userSelect:"none",background:on?"#eff6ff":BG,color:on?BL:MU,border:"0.5px solid "+(on?BL+"55":BR),fontWeight:on?500:400}}>{m}</div>;})}</div></div>
      <input value={medNotes} onChange={e=>onChange("medNotes",e.target.value)} placeholder="Other details: medications, emergency contacts, special needs..." style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:11,outline:"none",boxSizing:"border-box"}}/>
    </div>
  );
}

function BirthdayRow({dob,onChange,color}){
  const age=calcAge(dob);
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:6,alignItems:"end",marginBottom:6}}>
      <div><div style={{fontSize:10,color:MU,marginBottom:3}}>Birthday (full date)</div><input type="date" value={dob||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"5px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/></div>
      {age!==""&&<div style={{background:(color||N)+"14",borderRadius:6,padding:"6px 12px",fontSize:12,color:color||N,fontWeight:600,whiteSpace:"nowrap"}}>Age {age}</div>}
    </div>
  );
}

function FamilyForm({newVis,setNewVis,onSubmit,allPeople}){
  const [bbS,setBbS]=useState("");const[showBb,setShowBb]=useState(false);
  const fName=newVis.last?(newVis.last+" Family"):"Family";
  const bbR=bbS.trim().length>1?allPeople.filter(p=>(p.first+" "+p.last).toLowerCase().includes(bbS.toLowerCase())).slice(0,5):[];
  const addChild=()=>setNewVis(f=>({...f,children:[...(f.children||[]),{first:"",last:"",dob:"",allergies:[],medical:[],medNotes:""}]}));
  const remChild=idx=>setNewVis(f=>({...f,children:f.children.filter((_,i)=>i!==idx)}));
  const updChild=(idx,k,v)=>setNewVis(f=>({...f,children:f.children.map((c,i)=>i===idx?{...c,[k]:v}:c)}));
  const preview=[newVis.first&&newVis.last?(newVis.first+" "+newVis.last+(calcAge(newVis.dob)!==""?" (age "+calcAge(newVis.dob)+")":"")):null,newVis.spouseFirst&&newVis.spouseLast?(newVis.spouseFirst+" "+newVis.spouseLast+(calcAge(newVis.spouseDob)!==""?" (age "+calcAge(newVis.spouseDob)+")":"")):null,...(newVis.children||[]).filter(c=>c.first).map(c=>c.first+(c.last?" "+c.last:"")+(calcAge(c.dob)!==""?" (age "+calcAge(c.dob)+")":""))].filter(Boolean);
  return(
    <div style={{background:"#f0fdf4",border:"0.5px solid #86efac",borderRadius:10,padding:12,marginBottom:8,maxHeight:500,overflowY:"auto"}}>
      <div style={{fontSize:12,fontWeight:600,color:GR,marginBottom:10}}>New Visitor / Family Check-In</div>
      <div style={{background:W,borderRadius:8,padding:10,marginBottom:8,border:"0.5px solid "+G}}>
        <div style={{fontSize:11,fontWeight:600,color:"#7a5c10",marginBottom:7,textTransform:"uppercase",letterSpacing:0.4}}>Brought By</div>
        {newVis.broughtBy?(<div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:GL,borderRadius:6,border:"0.5px solid "+G}}><span style={{fontSize:12,fontWeight:500,color:"#7a5c10",flex:1}}>{newVis.broughtBy}</span><button onClick={()=>{setNewVis(f=>({...f,broughtBy:""}));setBbS("");}} style={{background:"none",border:"none",cursor:"pointer",color:MU,fontSize:14,lineHeight:1}}>x</button></div>):(
          <div style={{position:"relative"}}>
            <input value={bbS} onChange={e=>{setBbS(e.target.value);setShowBb(true);}} onFocus={()=>setShowBb(true)} onBlur={()=>setTimeout(()=>setShowBb(false),180)} placeholder="Search member or type who invited them..." style={{width:"100%",padding:"6px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
            {showBb&&bbR.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,background:W,border:"0.5px solid "+BR,borderRadius:6,zIndex:20,boxShadow:"0 4px 12px #00000018",marginTop:2}}>{bbR.map(p=><div key={p.id} onMouseDown={()=>{setNewVis(f=>({...f,broughtBy:p.first+" "+p.last}));setBbS(p.first+" "+p.last);setShowBb(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,borderBottom:"0.5px solid "+BR,display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:500}}>{p.first} {p.last}</span><span style={{fontSize:10,color:MU}}>{p.ptype==="member"?"Member":p.stage||"Visitor"}</span></div>)}<div onMouseDown={()=>{setNewVis(f=>({...f,broughtBy:bbS}));setShowBb(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:N,fontWeight:500,borderTop:"0.5px solid "+BR}}>Use "{bbS}" as entered</div></div>)}
          </div>
        )}
      </div>
      <div style={{background:W,borderRadius:8,padding:10,marginBottom:8,border:"0.5px solid "+BR}}>
        <div style={{fontSize:11,fontWeight:600,color:N,marginBottom:7,textTransform:"uppercase",letterSpacing:0.4}}>Head of Household *</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><SmlInp value={newVis.first} onChange={v=>setNewVis(f=>({...f,first:v}))} placeholder="First name *"/><SmlInp value={newVis.last} onChange={v=>setNewVis(f=>({...f,last:v}))} placeholder="Last name *"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><SmlInp value={newVis.phone||""} onChange={v=>setNewVis(f=>({...f,phone:v}))} placeholder="Phone number"/><SmlInp value={newVis.email||""} onChange={v=>setNewVis(f=>({...f,email:v}))} placeholder="Email address"/></div>
        <div style={{marginBottom:6}}><SmlInp value={newVis.familyName||""} onChange={v=>setNewVis(f=>({...f,familyName:v}))} placeholder={"Family name (default: "+fName+")"}/></div>
        <BirthdayRow dob={newVis.dob||""} onChange={v=>setNewVis(f=>({...f,dob:v}))} color={N}/>
        <MedSection allergies={newVis.allergies||[]} medical={newVis.medical||[]} medNotes={newVis.medNotes||""} onChange={(k,v)=>setNewVis(f=>({...f,[k]:v}))} required={false}/>
      </div>
      <div style={{background:W,borderRadius:8,padding:10,marginBottom:8,border:"0.5px solid "+BR}}>
        <div style={{fontSize:11,fontWeight:600,color:PU,marginBottom:7,textTransform:"uppercase",letterSpacing:0.4}}>Spouse (if present)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><SmlInp value={newVis.spouseFirst||""} onChange={v=>setNewVis(f=>({...f,spouseFirst:v}))} placeholder="Spouse first name"/><SmlInp value={newVis.spouseLast||""} onChange={v=>setNewVis(f=>({...f,spouseLast:v}))} placeholder="Spouse last name"/></div>
        {(newVis.spouseFirst||newVis.spouseLast)&&(<div><BirthdayRow dob={newVis.spouseDob||""} onChange={v=>setNewVis(f=>({...f,spouseDob:v}))} color={PU}/><MedSection allergies={newVis.spouseAllergies||[]} medical={newVis.spouseMedical||[]} medNotes={newVis.spouseMedNotes||""} onChange={(k,v)=>setNewVis(f=>({...f,["spouse"+k.charAt(0).toUpperCase()+k.slice(1)]:v}))} required={false}/></div>)}
      </div>
      <div style={{background:W,borderRadius:8,padding:10,marginBottom:8,border:"0.5px solid "+BR}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><div style={{fontSize:11,fontWeight:600,color:AM,textTransform:"uppercase",letterSpacing:0.4}}>Children (if present)</div><button onClick={addChild} style={{background:AM+"18",border:"0.5px solid "+AM+"55",borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:AM,fontWeight:600}}>+ Add Child</button></div>
        {(newVis.children||[]).length===0&&<div style={{fontSize:11,color:MU,fontStyle:"italic"}}>Click "+ Add Child" to add children.</div>}
        {(newVis.children||[]).map((child,ci)=>(
          <div key={ci} style={{background:BG,borderRadius:8,padding:10,marginBottom:8,border:"0.5px solid "+BR}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:11,color:AM,fontWeight:600}}>Child {ci+1}</div><button onClick={()=>remChild(ci)} style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:5,padding:"3px 8px",cursor:"pointer",color:RE,fontSize:11,fontWeight:600}}>Remove</button></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><SmlInp value={child.first} onChange={v=>updChild(ci,"first",v)} placeholder="First name *"/><SmlInp value={child.last} onChange={v=>updChild(ci,"last",v)} placeholder="Last name *"/></div>
            <BirthdayRow dob={child.dob||""} onChange={v=>updChild(ci,"dob",v)} color={AM}/>
            <MedSection allergies={child.allergies||[]} medical={child.medical||[]} medNotes={child.medNotes||""} onChange={(k,v)=>updChild(ci,k,v)} required={true}/>
          </div>
        ))}
      </div>
      {preview.length>0&&(<div style={{background:N+"0a",borderRadius:7,padding:"8px 10px",marginBottom:8,fontSize:11,color:N,lineHeight:1.7}}><div><strong>Checking in:</strong> {preview.join(", ")}</div>{newVis.broughtBy&&<div><strong>Brought by:</strong> {newVis.broughtBy}</div>}</div>)}
      <div style={{display:"flex",gap:6}}><button onClick={onSubmit} style={{flex:1,padding:"8px",background:GR,color:"#fff",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:500}}>Check In Family</button><button onClick={()=>setNewVis(null)} style={{padding:"8px 12px",background:BG,border:"0.5px solid "+BR,borderRadius:7,fontSize:12,cursor:"pointer"}}>Cancel</button></div>
    </div>
  );
}

function CalendarView({members,visitors,setVisitors,groups,recurring,setRecurring,custom,setCustom,checkIns,setCheckIns,grpMeetings=[],setGrpMeetings=()=>{}}){
  const [ctab,setCtab]=useState("calendar");
  const [yr,setYr]=useState(2026);const[mo,setMo]=useState(3);
  const [selDate,setSelDate]=useState("2026-04-20");const[selEvt,setSelEvt]=useState(null);
  const [selGrpEvt,setSelGrpEvt]=useState(null);
  const [search,setSearch]=useState("");const[newVis,setNewVis]=useState(null);
  const [grpCISearch,setGrpCISearch]=useState("");
  const [evtModal,setEvtModal]=useState(false);const[editEvt,setEditEvt]=useState(null);
  const [evtForm,setEvtForm]=useState({name:"",type:"Worship",time:"11:00 AM",location:"",color:N,recurring:true,dow:0,date:td()});
  const nid=useRef(900);const ef=k=>v=>setEvtForm(f=>({...f,[k]:v}));
  const todayStr=td();const grid=buildCGrid(yr,mo);
  const calGroups=groups.filter(g=>g.showOnCalendar);
  const dayEvts=selDate?cEventsFor(selDate,recurring,custom,[]):[];
  const dayGrpEvts=selDate?calGroups.filter(g=>CD2DOW[g.day]===new Date(selDate+"T00:00:00").getDay()).map(g=>({...g,iid:"g"+g.id+"_"+selDate,date:selDate})):[];
  const evtCIs=selEvt?checkIns.filter(c=>c.iid===selEvt.iid):[];
  const grpEvtCIs=selGrpEvt?checkIns.filter(c=>c.iid===selGrpEvt.iid):[];
  const grpCheckedIds=new Set(grpEvtCIs.map(c=>c.pid));
  const checkedIds=new Set(evtCIs.map(c=>c.pid));
  const allPeople=[...members.map(m=>({...m,ptype:"member"})),...visitors.map(v=>({...v,ptype:"visitor"}))];
  const results=search.trim().length>1?allPeople.filter(p=>(p.first+" "+p.last).toLowerCase().includes(search.toLowerCase())).slice(0,8):[];
  const totalCI=checkIns.length;const memCI=checkIns.filter(c=>c.ptype==="member").length;const visCI=checkIns.filter(c=>c.ptype==="visitor"&&!c.isNew).length;const newCI=checkIns.filter(c=>c.isNew).length;
  const prevMo=()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const nextMo=()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};
  const initV=()=>({first:"",last:"",phone:"",email:"",familyName:"",dob:"",spouseFirst:"",spouseLast:"",spouseDob:"",spouseAllergies:[],spouseMedical:[],spouseMedNotes:"",allergies:[],medical:[],medNotes:"",broughtBy:"",children:[]});

  const doCI=person=>{
    if(checkedIds.has(person.id))return;
    setCheckIns(cs=>[...cs,{id:nid.current++,iid:selEvt.iid,eid:selEvt.id,ename:selEvt.name,date:selEvt.date,time:selEvt.time,pid:person.id,ptype:person.ptype,first:person.first,last:person.last,phone:person.phone||"",isNew:false,role:"",family:"",broughtBy:"",dob:"",age:"",allergies:[],medical:[],medNotes:"",at:new Date().toLocaleTimeString()}]);
    setSearch("");
  };

  // Group check-in — marks member present and auto-logs to Groups Ministry attendance
  const doGrpCI=member=>{
    if(grpCheckedIds.has(member.id))return;
    const grp=selGrpEvt;
    // Add to calendar check-ins
    setCheckIns(cs=>[...cs,{id:nid.current++,iid:grp.iid,eid:"g"+grp.id,ename:grp.name,date:grp.date,time:grp.time,pid:member.id,ptype:"member",first:member.first,last:member.last,phone:member.phone||"",isNew:false,role:member.role||"Member",family:"",broughtBy:"",dob:"",age:"",allergies:[],medical:[],medNotes:"",at:new Date().toLocaleTimeString(),isGroupCI:true,groupId:grp.id}]);
    // Auto-log to Groups Ministry attendance
    const existingMeet=grpMeetings.find(m=>m.groupId===grp.id&&m.date===grp.date);
    if(existingMeet){
      if(!existingMeet.presentIds.includes(member.id)){
        setGrpMeetings(ms=>ms.map(m=>m.id===existingMeet.id?{...m,presentIds:[...m.presentIds,member.id],absentIds:m.absentIds.filter(id=>id!==member.id),total:m.total+1}:m));
      }
    } else {
      setGrpMeetings(ms=>[...ms,{id:nid.current++,groupId:grp.id,date:grp.date,presentIds:[member.id],absentIds:grp.memberIds.filter(id=>id!==member.id),walkIns:0,notes:"Auto-logged from calendar check-in",total:1}]);
    }
  };
  const doCIFam=()=>{
    if(!newVis||!newVis.first||!newVis.last){alert("First and last name required.");return;}
    const fam=newVis.familyName||(newVis.last+" Family");const bb=newVis.broughtBy||"";const entries=[];
    entries.push({id:nid.current++,first:newVis.first,last:newVis.last,phone:newVis.phone||"",email:newVis.email||"",dob:newVis.dob||"",age:calcAge(newVis.dob)||"",stage:"First Visit",family:fam,role:"Head of Household",broughtBy:bb,allergies:newVis.allergies||[],medical:newVis.medical||[],medNotes:newVis.medNotes||""});
    if(newVis.spouseFirst&&newVis.spouseLast)entries.push({id:nid.current++,first:newVis.spouseFirst,last:newVis.spouseLast,phone:newVis.phone||"",email:"",dob:newVis.spouseDob||"",age:calcAge(newVis.spouseDob)||"",stage:"First Visit",family:fam,role:"Spouse",broughtBy:bb,allergies:newVis.spouseAllergies||[],medical:newVis.spouseMedical||[],medNotes:newVis.spouseMedNotes||""});
    (newVis.children||[]).filter(c=>c.first).forEach(c=>entries.push({id:nid.current++,first:c.first,last:c.last,phone:"",email:"",dob:c.dob||"",age:calcAge(c.dob)||"",stage:"First Visit",family:fam,role:"Child",broughtBy:bb,allergies:c.allergies||[],medical:c.medical||[],medNotes:c.medNotes||""}));
    setVisitors(vs=>[...vs,...entries]);
    const base={iid:selEvt.iid,eid:selEvt.id,ename:selEvt.name,date:selEvt.date,time:selEvt.time,ptype:"visitor",isNew:true,at:new Date().toLocaleTimeString()};
    setCheckIns(cs=>[...cs,...entries.map(e=>({id:nid.current++,...base,pid:e.id,first:e.first,last:e.last,phone:e.phone||"",role:e.role,family:fam,broughtBy:bb,dob:e.dob,age:e.age,allergies:e.allergies,medical:e.medical,medNotes:e.medNotes}))]);
    setNewVis(null);setSearch("");
  };
  const saveEvt=()=>{if(!evtForm.name.trim()){alert("Event name required.");return;}if(editEvt){if(editEvt.dow!==undefined)setRecurring(rs=>rs.map(r=>r.id===editEvt.id?{...evtForm,id:editEvt.id,dow:+evtForm.dow,recurring:true}:r));else setCustom(cs=>cs.map(c=>c.id===editEvt.id?{...evtForm,id:editEvt.id}:c));}else{const id="ce"+nid.current++;if(evtForm.recurring)setRecurring(rs=>[...rs,{...evtForm,id,dow:+evtForm.dow}]);else setCustom(cs=>[...cs,{...evtForm,id}]);}setEvtModal(false);setEditEvt(null);};
  const openAdd=()=>{setEditEvt(null);setEvtForm({name:"",type:"Worship",time:"11:00 AM",location:"",color:N,recurring:true,dow:0,date:td()});setEvtModal(true);};
  const openEdit=e=>{setEditEvt(e);setEvtForm({...e,dow:e.dow??0,recurring:e.dow!==undefined});setEvtModal(true);};
  const tS=t=>t.replace(":00","").replace(" AM","a").replace(" PM","p");
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{background:N+"08",borderBottom:"0.5px solid "+BR,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",gap:0,background:W,borderRadius:8,border:"0.5px solid "+BR,overflow:"hidden"}}>
          {[["calendar","Calendar"],["log","Check-In Log"],["events","Manage Events"]].map(([id,label])=>(
            <button key={id} onClick={()=>setCtab(id)} style={{padding:"8px 16px",border:"none",borderBottom:"2px solid "+(ctab===id?G:"transparent"),background:ctab===id?"#f8f9fc":W,fontSize:12,fontWeight:ctab===id?500:400,color:ctab===id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              {label}{id==="log"&&totalCI>0&&<span style={{background:N,color:"#fff",borderRadius:10,fontSize:9,padding:"1px 5px"}}>{totalCI}</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:MU}}>{memCI} members · {visCI} visitors · {newCI} new today</div>
          <Btn onClick={openAdd} style={{fontSize:12,padding:"6px 12px"}}>+ Add Event</Btn>
        </div>
      </div>
      {ctab==="calendar"&&(
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:14,overflow:"hidden",minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={prevMo} style={{width:28,height:28,borderRadius:6,border:"0.5px solid "+BR,background:W,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{"<"}</button>
                <span style={{fontSize:15,fontWeight:500,color:N,minWidth:150,textAlign:"center"}}>{CMONTHS[mo]} {yr}</span>
                <button onClick={nextMo} style={{width:28,height:28,borderRadius:6,border:"0.5px solid "+BR,background:W,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{">"}</button>
                <button onClick={()=>{const n=new Date();setYr(n.getFullYear());setMo(n.getMonth());setSelDate(n.toISOString().split("T")[0]);}} style={{padding:"4px 10px",borderRadius:5,border:"0.5px solid "+BR,background:W,cursor:"pointer",fontSize:11,color:N}}>Today</button>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[[N,"Worship"],[G,"Education"],[GR,"Study"],[PU,"Prayer"],["#65a30d","Group"]].map(([c,t])=><div key={t} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,borderRadius:2,background:c}}></div><span style={{fontSize:10,color:MU}}>{t}</span></div>)}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:2}}>{CDNAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:500,color:MU,padding:"3px 0",textTransform:"uppercase",letterSpacing:0.5}}>{d}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,flex:1,overflow:"hidden"}}>
              {grid.map((cell,i)=>{
                const evts=cEventsFor(cell.date,recurring,custom,[]);
                const grpEvts=calGroups.filter(g=>CD2DOW[g.day]===new Date(cell.date+"T00:00:00").getDay());
                const allEvts=[...evts,...grpEvts];
                const isToday=cell.date===todayStr;const isSel=cell.date===selDate;const ciCnt=checkIns.filter(c=>c.date===cell.date).length;
                return(<div key={i} onClick={()=>{setSelDate(cell.date);setSelEvt(null);setSelGrpEvt(null);setSearch("");setNewVis(null);setGrpCISearch("");}}
                  style={{background:isSel?N+"0c":W,border:"0.5px solid "+(isSel?N:BR),borderRadius:6,padding:"4px",cursor:"pointer",overflow:"hidden",display:"flex",flexDirection:"column",opacity:cell.cur?1:0.35}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                    <div style={{width:19,height:19,borderRadius:"50%",background:isToday?N:"transparent",color:isToday?"#fff":TX,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:isToday?600:400}}>{new Date(cell.date+"T00:00:00").getDate()}</div>
                    {ciCnt>0&&<span style={{fontSize:8,background:GR,color:"#fff",borderRadius:6,padding:"0 3px",fontWeight:600}}>{ciCnt}</span>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:1,overflow:"hidden"}}>
                    {evts.slice(0,2).map((e,j)=><div key={j} style={{background:e.color,color:"#fff",borderRadius:2,padding:"1px 3px",fontSize:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.5}}>{tS(e.time)} {e.name}</div>)}
                    {grpEvts.slice(0,1).map((g,j)=><div key={"g"+j} style={{background:g.color+"cc",color:"#fff",borderRadius:2,padding:"1px 3px",fontSize:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.5,borderLeft:"2px solid #fff5"}}>G: {g.name}</div>)}
                    {allEvts.length>3&&<div style={{fontSize:8,color:MU}}>+{allEvts.length-3}</div>}
                  </div>
                </div>);
              })}
            </div>
          </div>
          <div style={{width:320,borderLeft:"0.5px solid "+BR,background:W,display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
            {selDate?(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div style={{padding:"12px 14px",borderBottom:"0.5px solid "+BR,background:N+"06",flexShrink:0}}><div style={{fontSize:13,fontWeight:500,color:N}}>{new Date(selDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div><div style={{fontSize:11,color:MU,marginTop:2}}>{dayEvts.length} events · {checkIns.filter(c=>c.date===selDate).length} check-ins</div></div>
                <div style={{flex:1,overflowY:"auto",padding:8}}>
                  {/* Church Events Section */}
                  {dayEvts.length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,padding:"4px 8px",background:N+"08",borderRadius:5}}>Church Events</div>
                      {dayEvts.map(evt=>{
                        const eci=checkIns.filter(c=>c.iid===evt.iid);const isSel=selEvt?.iid===evt.iid;
                        return(<div key={evt.iid} style={{marginBottom:6,border:"0.5px solid "+(isSel?evt.color:BR),borderRadius:10,overflow:"hidden"}}>
                          <div onClick={()=>{setSelEvt(isSel?null:evt);setSelGrpEvt(null);setSearch("");setNewVis(null);}} style={{padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:isSel?evt.color+"14":BG}}>
                            <div style={{width:4,height:34,borderRadius:2,background:evt.color,flexShrink:0}}></div>
                            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:isSel?evt.color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{evt.name}</div><div style={{fontSize:10,color:MU}}>{evt.time}{evt.location?" · "+evt.location:""}</div></div>
                            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:13,fontWeight:600,color:eci.length>0?GR:MU}}>{eci.length}</div><div style={{fontSize:9,color:MU}}>in</div></div>
                          </div>
                          {isSel&&(
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
                          )}
                        </div>);
                      })}
                    </div>
                  )}

                  {/* Group Meetings Section */}
                  {dayGrpEvts.length>0&&(
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:PU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,padding:"4px 8px",background:PU+"0a",borderRadius:5,display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:2,background:PU}}></div>
                        Group Meetings
                      </div>
                      {dayGrpEvts.map(grp=>{
                        const grpCIs=checkIns.filter(c=>c.iid===grp.iid);
                        const isSel=selGrpEvt?.iid===grp.iid;
                        const enrolled=members.filter(m=>grp.memberIds.includes(m.id));
                        const leader=members.find(m=>m.id===grp.leaderId);
                        const presentIds=new Set(grpCIs.map(c=>c.pid));
                        return(
                          <div key={grp.iid} style={{marginBottom:6,border:"1.5px solid "+(isSel?grp.color:grp.color+"44"),borderRadius:10,overflow:"hidden"}}>
                            <div onClick={()=>{setSelGrpEvt(isSel?null:grp);setSelEvt(null);setSearch("");setNewVis(null);setGrpCISearch("");}} style={{padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:isSel?grp.color+"14":grp.color+"06"}}>
                              <div style={{width:4,height:34,borderRadius:2,background:grp.color,flexShrink:0}}></div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:500,color:grp.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{grp.name}</div>
                                <div style={{fontSize:10,color:MU}}>{grp.time}{grp.location?" · "+grp.location:""}</div>
                                {leader&&<div style={{fontSize:9,color:grp.color,marginTop:1}}>Leader: {leader.first} {leader.last}</div>}
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:grpCIs.length>0?GR:MU}}>{grpCIs.length}/{enrolled.length}</div>
                                <div style={{fontSize:9,color:MU}}>checked in</div>
                              </div>
                            </div>
                            {isSel&&(
                              <div style={{borderTop:"0.5px solid "+grp.color+"44",padding:"10px 12px",background:grp.color+"04"}}>
                                {leader&&(
                                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:grp.color+"12",borderRadius:7,marginBottom:10,border:"0.5px solid "+grp.color+"33"}}>
                                    <Av f={leader.first} l={leader.last} sz={26}/>
                                    <div><div style={{fontSize:11,color:MU,lineHeight:1}}>Group Leader</div><div style={{fontSize:12,fontWeight:500,color:grp.color}}>{leader.first} {leader.last}</div></div>
                                    <span style={{marginLeft:"auto",fontSize:10,background:grp.color,color:"#fff",borderRadius:10,padding:"2px 8px",fontWeight:500}}>Leader</span>
                                  </div>
                                )}
                                <div style={{fontSize:10,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Group Member Check-In</div>
                                <input value={grpCISearch} onChange={e=>setGrpCISearch(e.target.value)} placeholder="Search group member..." style={{width:"100%",padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                  {enrolled.filter(m=>grpCISearch.trim().length<2||(m.first+" "+m.last).toLowerCase().includes(grpCISearch.toLowerCase())).map(m=>{
                                    const isIn=presentIds.has(m.id);
                                    return(
                                      <div key={m.id} onClick={()=>!isIn&&doGrpCI(m)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:"0.5px solid "+(isIn?GR+"55":BR),background:isIn?"#f0fdf4":W,cursor:isIn?"default":"pointer",transition:"all 0.1s"}}>
                                        <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isIn?GR:BR),background:isIn?GR:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                          {isIn&&<span style={{color:"#fff",fontSize:11,lineHeight:1}}>v</span>}
                                        </div>
                                        <Av f={m.first} l={m.last} sz={26}/>
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.first} {m.last}</div>
                                          <div style={{fontSize:10,color:MU}}>{m.role||"Member"}</div>
                                        </div>
                                        {m.id===grp.leaderId&&<span style={{fontSize:9,background:grp.color+"22",color:grp.color,borderRadius:8,padding:"1px 6px",fontWeight:500}}>Leader</span>}
                                        {isIn?<span style={{fontSize:10,color:GR,fontWeight:600}}>Present</span>:<span style={{fontSize:10,background:grp.color,color:"#fff",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>Mark In</span>}
                                      </div>
                                    );
                                  })}
                                  {enrolled.length===0&&<div style={{fontSize:12,color:MU,fontStyle:"italic",textAlign:"center",padding:12}}>No members enrolled in this group yet.</div>}
                                </div>
                                {grpCIs.length>0&&(
                                  <div style={{marginTop:10,padding:"8px 10px",background:"#f0fdf4",borderRadius:7,border:"0.5px solid #86efac"}}>
                                    <div style={{fontSize:10,color:GR,fontWeight:600,marginBottom:4}}>Auto-logged to Groups Ministry Attendance</div>
                                    <div style={{fontSize:11,color:MU}}>{grpCIs.length} of {enrolled.length} members marked present · {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {dayEvts.length===0&&dayGrpEvts.length===0&&<div style={{textAlign:"center",padding:24,color:MU,fontSize:12,fontStyle:"italic"}}>No events on this day.</div>}
                </div>
              </div>
            ):<div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,color:MU,fontSize:12,textAlign:"center",padding:20,lineHeight:1.8}}>Click any date to view events and check in attendees.</div>}
          </div>
        </div>
      )}
      {ctab==="log"&&(
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>{[["Total",totalCI,N],["Members",memCI,BL],["Visitors",visCI,AM],["New",newCI,GR]].map(([l,v,c])=><div key={l} style={{background:W,border:"0.5px solid "+BR,borderRadius:10,padding:"12px 14px",flex:1,minWidth:90}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{l}</div><div style={{fontSize:22,fontWeight:500,color:c}}>{v}</div></div>)}</div>
          {checkIns.length===0?<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU}}>No check-ins yet.</div>:(
            <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f8f9fc"}}>{["Name","Type","Role","Family","Brought By","Allergies/Medical","Event","Date"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
                <tbody>{[...checkIns].reverse().map(ci=>(
                  <tr key={ci.id} style={{borderBottom:"0.5px solid "+BR,background:ci.isNew?"#f0fdf4":W}}>
                    <td style={{padding:"9px 12px"}}><div style={{display:"flex",alignItems:"center",gap:7}}><Av f={ci.first} l={ci.last} sz={26}/><div><div style={{fontSize:12,fontWeight:500}}>{ci.first} {ci.last}</div>{ci.dob&&<div style={{fontSize:10,color:MU}}>{new Date(ci.dob+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}{ci.age!==""?" (age "+ci.age+")":""}</div>}</div></div></td>
                    <td style={{padding:"9px 12px"}}><span style={{fontSize:10,borderRadius:20,padding:"2px 8px",fontWeight:500,background:ci.isNew?"#dcfce7":ci.ptype==="member"?"#e3f2fd":"#fff3e0",color:ci.isNew?GR:ci.ptype==="member"?BL:AM}}>{ci.isNew?"New":ci.ptype==="member"?"Member":"Visitor"}</span></td>
                    <td style={{padding:"9px 12px",fontSize:11,color:MU}}>{ci.role||"—"}</td>
                    <td style={{padding:"9px 12px",fontSize:11,color:MU}}>{ci.family||"—"}</td>
                    <td style={{padding:"9px 12px",fontSize:11,color:MU}}>{ci.broughtBy||"—"}</td>
                    <td style={{padding:"9px 12px"}}><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{(ci.allergies||[]).map(a=><span key={a} style={{fontSize:9,background:"#fee2e2",color:RE,borderRadius:3,padding:"1px 5px"}}>{a}</span>)}{(ci.medical||[]).map(m=><span key={m} style={{fontSize:9,background:"#eff6ff",color:BL,borderRadius:3,padding:"1px 5px"}}>{m}</span>)}{!(ci.allergies||[]).length&&!(ci.medical||[]).length&&<span style={{fontSize:10,color:MU}}>—</span>}</div></td>
                    <td style={{padding:"9px 12px",fontSize:11}}>{ci.ename}</td>
                    <td style={{padding:"9px 12px",fontSize:10,color:MU}}>{ci.date?new Date(ci.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {ctab==="events"&&(
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Manage Events</h3><Btn onClick={openAdd}>+ Add Event</Btn></div>
          <div style={{marginBottom:16}}><div style={{fontSize:13,fontWeight:500,color:N,marginBottom:10}}>Recurring Weekly Events</div><div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>{recurring.map((e,i)=><div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<recurring.length-1?"0.5px solid "+BR:"none"}}><div style={{width:4,height:36,borderRadius:2,background:e.color,flexShrink:0}}></div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{e.name}</div><div style={{fontSize:11,color:MU}}>{CDNAMES[e.dow]} · {e.time}{e.location?" · "+e.location:""}</div></div><span style={{fontSize:11,background:e.color+"18",color:e.color,borderRadius:10,padding:"2px 8px",fontWeight:500}}>{e.type}</span><button onClick={()=>openEdit(e)} style={{padding:"4px 9px",borderRadius:6,border:"0.5px solid "+BR,background:BG,cursor:"pointer",fontSize:11}}>Edit</button><button onClick={()=>{if(confirm("Delete?"))setRecurring(rs=>rs.filter(r=>r.id!==e.id));}} style={{padding:"4px 9px",borderRadius:6,border:"0.5px solid #fca5a5",background:"#fee2e2",cursor:"pointer",fontSize:11,color:RE}}>Del</button></div>)}</div></div>
          {custom.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:13,fontWeight:500,color:N,marginBottom:10}}>One-Time Events</div><div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>{custom.map((e,i)=><div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<custom.length-1?"0.5px solid "+BR:"none"}}><div style={{width:4,height:36,borderRadius:2,background:e.color,flexShrink:0}}></div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{e.name}</div><div style={{fontSize:11,color:MU}}>{new Date(e.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · {e.time}</div></div><button onClick={()=>openEdit(e)} style={{padding:"4px 9px",borderRadius:6,border:"0.5px solid "+BR,background:BG,cursor:"pointer",fontSize:11}}>Edit</button><button onClick={()=>{if(confirm("Delete?"))setCustom(cs=>cs.filter(x=>x.id!==e.id));}} style={{padding:"4px 9px",borderRadius:6,border:"0.5px solid #fca5a5",background:"#fee2e2",cursor:"pointer",fontSize:11,color:RE}}>Del</button></div>)}</div></div>}
          <div><div style={{fontSize:13,fontWeight:500,color:N,marginBottom:10}}>Group Meetings (Auto-Synced)</div><div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>{groups.length===0&&<div style={{padding:20,textAlign:"center",color:MU,fontSize:12}}>No groups yet.</div>}{groups.map((g,i)=><div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<groups.length-1?"0.5px solid "+BR:"none"}}><div style={{width:4,height:36,borderRadius:2,background:g.color,flexShrink:0}}></div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{g.name}</div><div style={{fontSize:11,color:MU}}>{g.day} · {g.time}</div></div><span style={{fontSize:10,background:BG,color:MU,borderRadius:6,padding:"2px 7px"}}>Auto-synced</span></div>)}</div></div>
        </div>
      )}
      <Modal open={evtModal} onClose={()=>{setEvtModal(false);setEditEvt(null);}} title={editEvt?"Edit Event":"Add New Event"} width={460}>
        <Fld label="Event Name *"><Inp value={evtForm.name} onChange={ef("name")} placeholder="e.g. Sunday Morning Worship"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Type"><select value={evtForm.type} onChange={e=>ef("type")(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>{CETYPES.map(t=><option key={t}>{t}</option>)}</select></Fld><Fld label="Time"><Inp value={evtForm.time} onChange={ef("time")} placeholder="11:00 AM"/></Fld></div>
        <Fld label="Location"><Inp value={evtForm.location} onChange={ef("location")} placeholder="Sanctuary..."/></Fld>
        <Fld label="Color"><div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>{CECOLORS.map(c=><div key={c} onClick={()=>ef("color")(c)} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:evtForm.color===c?"3px solid #1f2937":"3px solid transparent",boxSizing:"border-box"}}/>)}</div></Fld>
        <Fld label="Recurrence"><div style={{display:"flex",gap:8}}>{[["true","Weekly"],["false","One-Time"]].map(([v,l])=><button key={v} onClick={()=>ef("recurring")(v==="true")} style={{flex:1,padding:"8px",borderRadius:8,border:"0.5px solid "+(String(evtForm.recurring)===v?N:BR),background:String(evtForm.recurring)===v?N:W,color:String(evtForm.recurring)===v?"#fff":TX,fontSize:12,cursor:"pointer"}}>{l}</button>)}</div></Fld>
        {evtForm.recurring?<Fld label="Day of Week"><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{CDNAMES.map((d,i)=><button key={i} onClick={()=>ef("dow")(i)} style={{padding:"5px 9px",borderRadius:6,border:"0.5px solid "+(evtForm.dow===i?N:BR),background:evtForm.dow===i?N:W,color:evtForm.dow===i?"#fff":TX,fontSize:11,cursor:"pointer"}}>{d}</button>)}</div></Fld>:<Fld label="Event Date"><Inp type="date" value={evtForm.date} onChange={ef("date")}/></Fld>}
        <div style={{display:"flex",gap:8,marginTop:4}}><Btn onClick={saveEvt} style={{flex:1,justifyContent:"center"}}>Save Event</Btn><Btn onClick={()=>{setEvtModal(false);setEditEvt(null);}} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
      </Modal>
    </div>
  );
}

// ── DASHBOARD ──
function Dashboard({members,visitors,attendance,giving,prayers,setView}) {
  const [insight,setInsight] = useState("");
  const [iLoad,setILoad] = useState(false);
  const [alerts,setAlerts] = useState([]);
  const [aLoad,setALoad] = useState(false);
  const nowYM = new Date().toISOString().slice(0,7); // e.g. "2026-04"
  const monthLabel = new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const totalG = giving.filter((g:any)=>g.date.startsWith(nowYM)).reduce((a:number,g:any)=>a+g.amount,0);
  const lastSvc = attendance[0];
  const activeM = members.filter((m:any)=>m.status==="Active").length;
  const fu = visitors.filter((v:any)=>v.stage==="Follow-Up Needed").length;

  const genInsight = async () => {
    setILoad(true);
    const prompt = "Give Pastor Hall a brief 3-4 sentence warm pastoral church health summary. Members:"+members.length+" ("+activeM+" active). Visitors:"+visitors.length+" ("+fu+" need follow-up). Last service:"+(lastSvc?lastSvc.count:0)+". "+monthLabel+" giving:$"+totalG+".";
    const txt = await callAI([{role:"user",content:prompt}],[],[],[],[],[],{});
    setInsight(txt); setILoad(false);
  };

  const genAlerts = async () => {
    setALoad(true);
    const inact = members.filter(m=>m.status==="Inactive").map(m=>m.first+" "+m.last).join(", ")||"none";
    const fuN = visitors.filter(v=>v.stage==="Follow-Up Needed").map(v=>v.first+" "+v.last).join(", ")||"none";
    const prompt = 'Generate 3 pastoral alerts for Pastor Hall. Inactive: '+inact+'. Follow-up needed: '+fuN+'. Return JSON only: [{"priority":"high","title":"short","detail":"one sentence"}]';
    const txt = await callAI([{role:"user",content:prompt}],[],[],[],[],[],{},"You are NTCC AI. Output only valid JSON.");
    try { const c=txt.replace(/```json|```/g,"").trim(); setAlerts(JSON.parse(c)); }
    catch(e) { setAlerts([{priority:"medium",title:"Review follow-ups",detail:"Check visitors needing follow-up this week."}]); }
    setALoad(false);
  };

  const pc = (p:string) => p==="high"?RE:p==="medium"?AM:GR;
  const qnav=[["Directory","people"],["Visitation","visitation"],["Attendance","attendance"],["Giving","giving"],["Prayer Wall","prayer"],["Access Control","access"],["AI Assistant","ai"],["Settings","settings"]];

  return (
    <div>
      {/* Add Person Banner */}
      <div onClick={()=>setView("addperson")} style={{background:"linear-gradient(135deg,"+N+",#2a4a8a)",borderRadius:12,padding:"16px 22px",marginBottom:20,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{color:G,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:3}}>Central Intake</div>
          <div style={{color:"#fff",fontSize:16,fontWeight:500}}>➕ Add New Person to Database</div>
          <div style={{color:"#7a9acc",fontSize:12,marginTop:3}}>Members · Visitors · Full intake form with all fields</div>
        </div>
        <div style={{color:"#fff",fontSize:28,opacity:0.5}}>→</div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <Stat label="Active Members" value={activeM} sub={"of "+members.length+" total"}/>
        <Stat label="Visitors" value={visitors.length} sub={fu+" need follow-up"} color={AM}/>
        <Stat label="Last Service" value={lastSvc?lastSvc.count:0} sub={lastSvc?lastSvc.service:""} color={BL}/>
        <Stat label={monthLabel+" Giving"} value={f$(totalG)} sub="Tithes and offerings" color={GR}/>
        <Stat label="Prayer Requests" value={prayers.filter((p:any)=>p.status==="Active").length} sub="Active" color={PU}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>AI Church Health</h3>
            <Btn onClick={genInsight} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{iLoad?"Analyzing...":"Generate"}</Btn>
          </div>
          <p style={{fontSize:13,lineHeight:1.7,color:insight?TX:MU,fontStyle:insight?"normal":"italic",margin:0}}>{insight||"Click Generate for an AI summary of your church's health, Pastor Hall."}</p>
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Smart Alerts</h3>
            <Btn onClick={genAlerts} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{aLoad?"Scanning...":"Scan Now"}</Btn>
          </div>
          {alerts.length>0 ? alerts.map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:pc(a.priority),marginTop:4,flexShrink:0}}></div>
              <div><div style={{fontSize:13,fontWeight:500}}>{a.title}</div><div style={{fontSize:12,color:MU}}>{a.detail}</div></div>
            </div>
          )) : <p style={{fontSize:13,color:MU,fontStyle:"italic",margin:0}}>Click Scan Now to generate AI-powered action alerts.</p>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Quick Navigation</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {qnav.map(([label,id])=>(
              <button key={id} onClick={()=>setView(id)} style={{padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,background:BG,cursor:"pointer",textAlign:"left",fontSize:13,color:TX,display:"flex",alignItems:"center",gap:8}}>
                {label}
                {id==="people"&&fu>0&&<span style={{marginLeft:"auto",background:RE,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px"}}>{fu}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Recent Activity</h3>
          {(()=>{
            const allGiving=[...giving].sort((a:any,b:any)=>b.date.localeCompare(a.date)).slice(0,3).map((g:any)=>({text:g.name+" gave "+f$(g.amount),sub:fd(g.date),color:G}));
            const recentM=[...members].sort((a:any,b:any)=>(b.joined||b.addedDate||"").localeCompare(a.joined||a.addedDate||"")).slice(0,2).map((m:any)=>({text:m.first+" "+m.last,sub:"Member"+((m.role)?": "+m.role:""),color:GR}));
            const recentV=[...visitors].sort((a:any,b:any)=>(b.firstVisit||b.addedDate||"").localeCompare(a.firstVisit||a.addedDate||"")).slice(0,1).map((v:any)=>({text:v.first+" "+v.last,sub:"Visitor · "+v.stage,color:AM}));
            const items=[...recentM,...recentV,...allGiving].slice(0,6);
            if(items.length===0) return <p style={{fontSize:13,color:MU,fontStyle:"italic",margin:0}}>No recent activity yet.</p>;
            return items.map((r:any,i:number)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:r.color,flexShrink:0}}></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.text}</div>
                  <div style={{fontSize:11,color:MU}}>{r.sub}</div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

// ── PEOPLE ──
function People({members,setMembers,visitors,setVisitors,attendance,giving,prayers,groups,grpMeetings,visitRecords,setVisitRecords,checkIns,setView}:any) {
  const [tab,setTab] = useState("members");
  const [search,setSearch] = useState("");
  const [modal,setModal] = useState(false);
  const [detail,setDetail] = useState(null);
  const [editMode,setEditMode] = useState(false);
  const [editForm,setEditForm] = useState({});
  const [aiMsg,setAiMsg] = useState("");
  const [aiLoad,setAiLoad] = useState(false);
  const [detailTab,setDetailTab] = useState("personal");
  const nid = useRef(200);

  const blankForm = () => ({first:"",last:"",status:"Active",role:"",phone:"",email:"",joined:td(),family:"",notes:"",stage:"First Visit",firstVisit:td(),sponsor:"",...EMPTY_PERSON_FIELDS,address:{...EMPTY_ADDR}});
  const [form,setForm] = useState(blankForm());

  const sf = k => v => setForm(f=>({...f,[k]:v}));
  const ef = k => v => setEditForm(f=>({...f,[k]:v}));
  const efa = k => v => setEditForm(f=>({...f,address:{...(f.address||{...EMPTY_ADDR}),[k]:v}}));

  const getStats = p => {
    if(!p) return null;
    const fullName = p.first + " " + p.last;
    const gives = giving.filter(g => g.name === fullName);
    const totalGiven = gives.reduce((a,g)=>a+g.amount, 0);
    const lastGift = gives.length ? [...gives].sort((a,b)=>b.date.localeCompare(a.date))[0] : null;
    const avgGift = gives.length ? Math.round(totalGiven/gives.length) : 0;
    const byCat = {};
    gives.forEach(g => { byCat[g.category] = (byCat[g.category]||0) + g.amount; });

    const memberGroups = groups.filter(g => g.memberIds.includes(p.id));
    const ledGroups = groups.filter(g => g.leaderId === p.id);

    const personPrayers = prayers.filter(pr => pr.name === fullName);
    const activePrayers = personPrayers.filter(pr => pr.status === "Active").length;
    const answeredPrayers = personPrayers.filter(pr => pr.status === "Answered").length;

    const pType = p._type === "members" ? "member" : "visitor";
    const personCIs = checkIns.filter(c => c.pid === p.id && c.ptype === pType);
    const lastAttended = personCIs.length ? [...personCIs].sort((a,b)=>b.date.localeCompare(a.date))[0].date : null;
    const uniqueEvents = new Set(personCIs.map(c => (c.eid||"") + "_" + c.date)).size;

    const groupAttendance = memberGroups.map(g => {
      const meets = grpMeetings.filter(m => m.groupId === g.id);
      const present = meets.filter(m => m.presentIds.includes(p.id)).length;
      return {group: g, rate: meets.length ? Math.round(present/meets.length*100) : 0, present, total: meets.length};
    });

    const visitRecord = p._type === "visitors" ? visitRecords.find(r => r.visitorId === p.id) : null;
    const daysInPipeline = visitRecord ? Math.floor((new Date() - new Date(visitRecord.createdDate+"T00:00:00"))/(1000*60*60*24)) : 0;

    return {gives,totalGiven,lastGift,avgGift,byCat,memberGroups,ledGroups,groupAttendance,personPrayers,activePrayers,answeredPrayers,personCIs,lastAttended,uniqueEvents,visitRecord,daysInPipeline};
  };

  const filt = tab==="members" ? members.filter(m=>(m.first+" "+m.last).toLowerCase().includes(search.toLowerCase())) : visitors.filter(v=>(v.first+" "+v.last).toLowerCase().includes(search.toLowerCase()));
  const stats = detail ? getStats(detail) : null;

  const saveNew = () => {
    if(!form.first||!form.last){alert("Name required.");return;}
    const id = nid.current++;
    if(tab==="members") setMembers([{...form,id,type:"Member"},...members]);
    else setVisitors([{...form,id,type:"Visitor"},...visitors]);
    setModal(false); setForm(blankForm());
  };
  const openDetail = p => {
    setDetail({...p,_type:tab});
    setEditForm({...p,address:p.address||{...EMPTY_ADDR},children:p.children||[],allergies:p.allergies||[],medical:p.medical||[]});
    setEditMode(false); setAiMsg(""); setDetailTab("personal");
  };
  const saveEdit = () => {
    if(!editForm.first||!editForm.last){alert("Name required.");return;}
    if(detail._type==="members") setMembers(ms=>ms.map(m=>m.id===detail.id?{...m,...editForm}:m));
    else setVisitors(vs=>vs.map(v=>v.id===detail.id?{...v,...editForm}:v));
    setDetail({...detail,...editForm}); setEditMode(false);
  };
  const delPerson = () => {
    if(!confirm("Delete "+detail.first+" "+detail.last+"? This cannot be undone."))return;
    if(detail._type==="members") setMembers(ms=>ms.filter(m=>m.id!==detail.id));
    else setVisitors(vs=>vs.filter(v=>v.id!==detail.id));
    setDetail(null);
  };
  const convertToMember = () => {
    if(!confirm("Convert "+detail.first+" "+detail.last+" to a member? Ongoing sponsor care will automatically stop."))return;
    const {_type,stage,firstVisit,sponsor,...rest} = detail;
    setMembers(ms=>[{...rest,status:"Active",role:"",joined:td(),family:detail.family||(detail.last+" Household")},...ms]);
    setVisitors(vs=>vs.filter(v=>v.id!==detail.id));
    // Auto-complete any visit record for this visitor
    if(setVisitRecords) setVisitRecords(rs=>rs.map(r=>r.visitorId===detail.id?{...r,stage:"Complete",completedDate:td(),completionReason:"Converted to member"}:r));
    setDetail(null);
  };  const genFollow = async () => {
    setAiLoad(true);
    const p = detail;
    const prompt = "Write a warm 3-4 sentence pastoral follow-up for "+p.first+" "+p.last+", a "+(p._type==="members"?"church member":"visitor")+(p.stage?" ("+p.stage+")":"")+(p.role?" serving as "+p.role:"")+"."+(p.notes?" Notes: "+p.notes+".":"")+" Sign from Pastor Hall and NTCC.";
    const txt = await callAI([{role:"user",content:prompt}],[],[],[],[],[],{});
    setAiMsg(txt); setAiLoad(false);
  };
  const toggleStatus = () => {
    const newStatus = detail.status==="Active"?"Inactive":"Active";
    setMembers(ms=>ms.map(m=>m.id===detail.id?{...m,status:newStatus}:m));
    setDetail({...detail,status:newStatus});
  };
  const addChild = () => setEditForm(f=>({...f,children:[...(f.children||[]),{name:"",birthday:""}]}));
  const updChild = (i,k,v) => setEditForm(f=>({...f,children:f.children.map((c,idx)=>idx===i?{...c,[k]:v}:c)}));
  const remChild = i => setEditForm(f=>({...f,children:f.children.filter((_,idx)=>idx!==i)}));
  const toggleArr = (field,item) => setEditForm(f=>{const arr=f[field]||[];return {...f,[field]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]};});

  const hdrs = ["Name",tab==="members"?"Role":"Stage","Phone",tab==="members"?"Joined":"First Visit",tab==="members"?"Status":"Sponsor","Actions"];

  const InfoRow = ({label,value,empty="Not on file"}) => (
    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"0.5px solid "+BR,alignItems:"baseline",gap:10}}>
      <span style={{fontSize:11,color:MU,fontWeight:500,flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,fontWeight:500,color:value?TX:MU,fontStyle:value?"normal":"italic",textAlign:"right",wordBreak:"break-word"}}>{value||empty}</span>
    </div>
  );
  const SectionCard = ({title,children}) => (
    <div style={{background:W,border:"0.5px solid "+BR,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
      <div style={{fontSize:11,color:N,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,fontWeight:600}}>{title}</div>
      {children}
    </div>
  );
  const MiniStat = ({label,value,color=N,sub}) => (
    <div style={{background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"9px 11px",flex:1,minWidth:0}}>
      <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4,marginBottom:2}}>{label}</div>
      <div style={{fontSize:17,fontWeight:500,color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</div>
      {sub && <div style={{fontSize:10,color:MU,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
    </div>
  );
  const formatAddr = a => !a||!a.street ? "" : a.street + (a.city?", "+a.city:"") + (a.state?", "+a.state:"") + (a.zip?" "+a.zip:"");
  const TABS = [{id:"personal",label:"Personal"},{id:"family",label:"Family"},{id:"activity",label:"Activity"},{id:"groups",label:"Groups"},{id:"pastoral",label:"Pastoral"},{id:"notes",label:"Notes"}];

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        {["members","visitors"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 18px",borderRadius:8,cursor:"pointer",border:"0.5px solid "+BR,background:tab===t?N:W,color:tab===t?"#fff":TX,fontSize:13,fontWeight:tab===t?500:400}}>
            {t==="members"?"Members ("+members.length+")":"Visitors ("+visitors.length+")"}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{flex:1,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <Btn onClick={()=>setView("addperson")}>+ Add {tab==="members"?"Member":"Visitor"}</Btn>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8f9fc"}}>{hdrs.map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
          <tbody>
            {filt.map(p=>(
              <tr key={p.id} onClick={()=>openDetail(p)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="#f8f9fc"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Av f={p.first} l={p.last}/>
                    <div><div style={{fontSize:13,fontWeight:500,color:N}}>{p.first} {p.last}</div><div style={{fontSize:11,color:MU}}>{p.email||"No email"}</div></div>
                  </div>
                </td>
                <td style={{padding:"10px 14px",fontSize:13}}>{tab==="members"?(p.role||"Member"):<Badge label={p.stage}/>}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{p.phone||"No phone"}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{fd(tab==="members"?p.joined:p.firstVisit)}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{tab==="members"?<Badge label={p.status}/>:(p.sponsor||"Unassigned")}</td>
                <td style={{padding:"10px 14px"}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:"flex",gap:6}}>
                    <Btn onClick={()=>openDetail(p)} v="ai" style={{fontSize:11,padding:"4px 8px"}}>View</Btn>
                    <Btn onClick={()=>{if(confirm("Delete "+p.first+" "+p.last+"?")){if(tab==="members") setMembers(members.filter(m=>m.id!==p.id)); else setVisitors(visitors.filter(v=>v.id!==p.id));}}} v="danger" style={{fontSize:11,padding:"4px 8px"}}>X</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {filt.length===0 && <tr><td colSpan={6} style={{padding:40,textAlign:"center",color:MU}}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add New Modal — simplified, rich fields editable after */}
      <Modal open={modal} onClose={()=>setModal(false)} title={"Add "+(tab==="members"?"Member":"Visitor")}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="First Name *"><Inp value={form.first} onChange={sf("first")}/></Fld>
          <Fld label="Last Name *"><Inp value={form.last} onChange={sf("last")}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Phone"><Inp value={form.phone} onChange={sf("phone")}/></Fld>
          <Fld label="Email"><Inp value={form.email} onChange={sf("email")}/></Fld>
        </div>
        {tab==="members" ? (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Fld label="Status"><Slt value={form.status} onChange={sf("status")} opts={["Active","Inactive"]}/></Fld>
              <Fld label="Role"><Inp value={form.role} onChange={sf("role")} placeholder="Deacon, Choir..."/></Fld>
            </div>
            <Fld label="Join Date"><Inp type="date" value={form.joined} onChange={sf("joined")}/></Fld>
          </div>
        ) : (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Fld label="Stage"><Slt value={form.stage} onChange={sf("stage")} opts={["First Visit","Follow-Up Needed","Returning","Prospect","Member"]}/></Fld>
              <Fld label="Sponsor"><Inp value={form.sponsor} onChange={sf("sponsor")}/></Fld>
            </div>
            <Fld label="First Visit"><Inp type="date" value={form.firstVisit} onChange={sf("firstVisit")}/></Fld>
          </div>
        )}
        <Fld label="Notes"><Inp value={form.notes} onChange={sf("notes")}/></Fld>
        <div style={{fontSize:11,color:MU,marginBottom:14,padding:"8px 10px",background:BG,borderRadius:6}}>Tip: Address, birthday, family, medical info, and more can be added after creating — just click the record.</div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={saveNew} style={{flex:1,justifyContent:"center"}}>Save</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>

      {/* DETAIL MODAL — full profile view */}
      <Modal open={!!detail} onClose={()=>{setDetail(null);setAiMsg("");setEditMode(false);}} title="" width={640}>
        {detail && stats && (
          <div style={{marginTop:-14}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0 16px",borderBottom:"0.5px solid "+BR,marginBottom:14}}>
              <Av f={detail.first} l={detail.last} sz={56}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:19,fontWeight:500,color:N}}>{detail.first} {detail.last}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
                  {detail._type==="members" ? <Badge label={detail.status||"Active"}/> : <Badge label={detail.stage||"Visitor"}/>}
                  {detail._type==="members" && detail.role && <span style={{fontSize:11,background:GL,color:"#7a5c10",borderRadius:20,padding:"2px 10px",fontWeight:500}}>{detail.role}</span>}
                  {detail.family && <span style={{fontSize:11,color:MU}}>{detail.family}</span>}
                </div>
              </div>
              {!editMode && (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <Btn onClick={()=>setEditMode(true)} v="outline" style={{fontSize:12,padding:"5px 12px"}}>Edit Profile</Btn>
                  <Btn onClick={delPerson} v="danger" style={{fontSize:12,padding:"5px 12px"}}>Delete</Btn>
                </div>
              )}
            </div>

            {!editMode && (
              <div>
                {/* KPI Summary Cards */}
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <MiniStat label="Services" value={stats.uniqueEvents} sub={stats.lastAttended?"Last "+fd(stats.lastAttended):"None yet"} color={BL}/>
                  <MiniStat label="Total Given" value={f$(stats.totalGiven)} sub={stats.gives.length+" gift"+(stats.gives.length!==1?"s":"")} color={GR}/>
                  <MiniStat label="Groups" value={stats.memberGroups.length} sub={stats.ledGroups.length>0?"Leads "+stats.ledGroups.length:"Member"} color={PU}/>
                  <MiniStat label="Prayer" value={stats.personPrayers.length} sub={stats.activePrayers+" active"} color={AM}/>
                </div>

                {/* Address bar — always visible if set */}
                {formatAddr(detail.address) && (
                  <div style={{background:N+"0a",border:"0.5px solid "+N+"33",borderRadius:8,padding:"9px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:N,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Address</span>
                    <span style={{fontSize:13,color:TX,flex:1,minWidth:200}}>{formatAddr(detail.address)}</span>
                    <a href={"https://maps.google.com/?q="+encodeURIComponent(formatAddr(detail.address))} target="_blank" rel="noopener" style={{fontSize:11,color:N,textDecoration:"none",fontWeight:500,background:W,border:"0.5px solid "+N+"44",borderRadius:6,padding:"3px 10px"}}>Open Map</a>
                  </div>
                )}

                {/* Tab Bar */}
                <div style={{display:"flex",marginBottom:14,background:BG,borderRadius:8,padding:3,overflowX:"auto"}}>
                  {TABS.map(t=>(
                    <button key={t.id} onClick={()=>setDetailTab(t.id)} style={{flex:"1 1 0",padding:"7px 10px",borderRadius:6,border:"none",background:detailTab===t.id?W:"transparent",color:detailTab===t.id?N:MU,fontSize:12,fontWeight:detailTab===t.id?500:400,cursor:"pointer",boxShadow:detailTab===t.id?"0 1px 3px #00000010":"none",whiteSpace:"nowrap"}}>{t.label}</button>
                  ))}
                </div>

                {/* PERSONAL TAB */}
                {detailTab==="personal" && (
                  <div>
                    <SectionCard title="Contact Information">
                      <InfoRow label="Phone" value={detail.phone}/>
                      <InfoRow label="Email" value={detail.email}/>
                      <InfoRow label="Occupation" value={detail.occupation}/>
                      <InfoRow label="Employer" value={detail.employer}/>
                    </SectionCard>
                    <SectionCard title="Address">
                      {formatAddr(detail.address) ? (
                        <div style={{fontSize:13,lineHeight:1.7}}>
                          <div>{detail.address.street}</div>
                          <div>{detail.address.city}{detail.address.city?", ":""}{detail.address.state} {detail.address.zip}</div>
                        </div>
                      ) : <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>No address on file. Click Edit Profile to add.</div>}
                    </SectionCard>
                    <SectionCard title="Important Dates">
                      <InfoRow label="Birthday" value={detail.birthday?fd(detail.birthday)+(calcAge(detail.birthday)!==""?" (age "+calcAge(detail.birthday)+")":""):""}/>
                      <InfoRow label="Anniversary" value={detail.anniversary?fd(detail.anniversary):""}/>
                      <InfoRow label="Salvation Date" value={detail.salvationDate?fd(detail.salvationDate):""}/>
                      <InfoRow label="Baptism Date" value={detail.baptismDate?fd(detail.baptismDate):""}/>
                      <InfoRow label={detail._type==="members"?"Member Since":"First Visit"} value={fd(detail._type==="members"?detail.joined:detail.firstVisit)}/>
                    </SectionCard>
                    <SectionCard title="Emergency Contact">
                      <InfoRow label="Name" value={detail.emergencyName}/>
                      <InfoRow label="Phone" value={detail.emergencyPhone}/>
                      <InfoRow label="Relationship" value={detail.emergencyRelation}/>
                    </SectionCard>
                  </div>
                )}

                {/* FAMILY TAB */}
                {detailTab==="family" && (
                  <div>
                    <SectionCard title="Spouse">
                      {detail.spouseName ? <div style={{fontSize:13,fontWeight:500}}>{detail.spouseName}</div> : <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>No spouse listed</div>}
                    </SectionCard>
                    <SectionCard title={"Children ("+(detail.children||[]).length+")"}>
                      {(detail.children||[]).length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>No children listed</div> :
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {detail.children.map((c,i)=>{
                            const parts = (c.name||"").trim().split(" ");
                            return (
                              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:BG,borderRadius:7,border:"0.5px solid "+BR}}>
                                <Av f={parts[0]||"?"} l={parts.slice(1).join(" ")||"?"} sz={26}/>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:13,fontWeight:500}}>{c.name||"Unnamed"}</div>
                                  {c.birthday && <div style={{fontSize:11,color:MU}}>{fd(c.birthday)}{calcAge(c.birthday)!==""?" · Age "+calcAge(c.birthday):""}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      }
                    </SectionCard>
                    <SectionCard title="Medical and Allergies">
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:11,color:MU,marginBottom:4,fontWeight:500}}>Allergies</div>
                        {(detail.allergies||[]).length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>None recorded</div> :
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{detail.allergies.map(a=><span key={a} style={{fontSize:11,background:"#fee2e2",color:RE,borderRadius:4,padding:"2px 8px",fontWeight:500}}>{a}</span>)}</div>
                        }
                      </div>
                      <div style={{marginBottom:detail.medicalNotes?8:0}}>
                        <div style={{fontSize:11,color:MU,marginBottom:4,fontWeight:500}}>Conditions</div>
                        {(detail.medical||[]).length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>None recorded</div> :
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{detail.medical.map(m=><span key={m} style={{fontSize:11,background:"#eff6ff",color:BL,borderRadius:4,padding:"2px 8px",fontWeight:500}}>{m}</span>)}</div>
                        }
                      </div>
                      {detail.medicalNotes && (
                        <div>
                          <div style={{fontSize:11,color:MU,marginBottom:4,fontWeight:500}}>Notes</div>
                          <div style={{fontSize:12,color:TX,background:BG,borderRadius:6,padding:"6px 10px"}}>{detail.medicalNotes}</div>
                        </div>
                      )}
                    </SectionCard>
                  </div>
                )}

                {/* ACTIVITY TAB */}
                {detailTab==="activity" && (
                  <div>
                    <SectionCard title="Attendance Summary">
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <MiniStat label="Services Attended" value={stats.uniqueEvents} color={BL}/>
                        <MiniStat label="Check-Ins" value={stats.personCIs.length} color={N}/>
                      </div>
                      <InfoRow label="Last Attended" value={stats.lastAttended?fd(stats.lastAttended):""}/>
                      <InfoRow label={detail._type==="members"?"Member Since":"First Visit"} value={fd(detail._type==="members"?detail.joined:detail.firstVisit)}/>
                    </SectionCard>
                    <SectionCard title="Giving Summary">
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        <MiniStat label="Total Given" value={f$(stats.totalGiven)} color={GR}/>
                        <MiniStat label="Avg Gift" value={f$(stats.avgGift)} color={G}/>
                        <MiniStat label="Records" value={stats.gives.length}/>
                      </div>
                      <InfoRow label="Last Gift" value={stats.lastGift?fd(stats.lastGift.date)+" · "+f$(stats.lastGift.amount):""}/>
                      {Object.keys(stats.byCat).length > 0 && (
                        <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid "+BR}}>
                          <div style={{fontSize:11,color:MU,marginBottom:6,fontWeight:500,textTransform:"uppercase",letterSpacing:0.4}}>By Category</div>
                          {Object.entries(stats.byCat).map(([cat,amt])=>(
                            <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
                              <span style={{color:MU}}>{cat}</span>
                              <span style={{fontWeight:500,color:GR}}>{f$(amt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                )}

                {/* GROUPS TAB */}
                {detailTab==="groups" && (
                  <div>
                    {stats.ledGroups.length > 0 && (
                      <SectionCard title={"Leads ("+stats.ledGroups.length+")"}>
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {stats.ledGroups.map(g=>(
                            <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:g.color+"10",borderRadius:8,border:"0.5px solid "+g.color+"44"}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:g.color,flexShrink:0}}></div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:500,color:g.color}}>{g.name}</div>
                                <div style={{fontSize:11,color:MU}}>{g.day} · {g.time} · {g.memberIds.length} members</div>
                              </div>
                              <span style={{fontSize:10,background:g.color,color:"#fff",borderRadius:10,padding:"2px 8px",fontWeight:500}}>LEADER</span>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    )}
                    <SectionCard title={"Enrolled ("+stats.memberGroups.length+")"}>
                      {stats.memberGroups.length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>Not enrolled in any groups yet</div> :
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {stats.groupAttendance.map(({group:g,rate,present,total})=>{
                            const pc = rate>=75?GR:rate>=50?AM:RE;
                            return (
                              <div key={g.id} style={{padding:"9px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}>
                                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:total>0?6:0}}>
                                  <div style={{width:8,height:8,borderRadius:"50%",background:g.color,flexShrink:0}}></div>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:13,fontWeight:500,color:g.color}}>{g.name}</div>
                                    <div style={{fontSize:11,color:MU}}>{g.day} · {g.time}</div>
                                  </div>
                                  {total>0 && <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:500,color:pc}}>{rate}%</div><div style={{fontSize:9,color:MU}}>{present}/{total}</div></div>}
                                </div>
                                {total>0 && <div style={{height:4,background:BR,borderRadius:2,overflow:"hidden"}}><div style={{width:rate+"%",height:"100%",background:pc,borderRadius:2}}></div></div>}
                              </div>
                            );
                          })}
                        </div>
                      }
                    </SectionCard>
                  </div>
                )}

                {/* PASTORAL TAB */}
                {detailTab==="pastoral" && (
                  <div>
                    <SectionCard title={"Prayer Requests ("+stats.personPrayers.length+")"}>
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        <MiniStat label="Active" value={stats.activePrayers} color={AM}/>
                        <MiniStat label="Answered" value={stats.answeredPrayers} color={GR}/>
                      </div>
                      {stats.personPrayers.length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>No prayer requests on file</div> :
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {stats.personPrayers.slice(0,3).map(pr=>(
                            <div key={pr.id} style={{padding:"8px 11px",background:BG,borderRadius:7,border:"0.5px solid "+BR}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                                <span style={{fontSize:11,color:MU}}>{fd(pr.date)}</span>
                                <span style={{fontSize:10,borderRadius:10,padding:"1px 7px",fontWeight:500,background:pr.status==="Answered"?"#dcfce7":"#fef9c3",color:pr.status==="Answered"?GR:"#854d0e"}}>{pr.status}</span>
                              </div>
                              <div style={{fontSize:12,lineHeight:1.5}}>{pr.request}</div>
                            </div>
                          ))}
                          {stats.personPrayers.length>3 && <div style={{fontSize:11,color:MU,textAlign:"center",fontStyle:"italic"}}>+{stats.personPrayers.length-3} more in Prayer Wall</div>}
                        </div>
                      }
                    </SectionCard>
                    {detail._type==="visitors" && stats.visitRecord && (
                      <SectionCard title="Visitation Pipeline">
                        <div style={{display:"flex",gap:8,marginBottom:10}}>
                          <MiniStat label="Stage" value={VS[stats.visitRecord.stage]} color={VC[stats.visitRecord.stage]}/>
                          <MiniStat label="Contacts" value={stats.visitRecord.contacts.length} color={N}/>
                          <MiniStat label="Days Open" value={stats.daysInPipeline} color={G}/>
                        </div>
                        <InfoRow label="Sponsor" value={detail.sponsor}/>
                        <InfoRow label="First Visit" value={fd(detail.firstVisit)}/>
                        {stats.visitRecord.contacts.length>0 && (()=>{const lc=stats.visitRecord.contacts[stats.visitRecord.contacts.length-1];return <InfoRow label="Last Contact" value={lc.method+" on "+fd(lc.date)}/>;})()}
                      </SectionCard>
                    )}
                    {detail._type==="visitors" && <Btn onClick={convertToMember} v="success" style={{width:"100%",justifyContent:"center"}}>Convert to Member</Btn>}
                    {detail._type==="members" && <Btn onClick={toggleStatus} v="outline" style={{width:"100%",justifyContent:"center"}}>Mark as {detail.status==="Active"?"Inactive":"Active"}</Btn>}
                  </div>
                )}

                {/* NOTES TAB */}
                {detailTab==="notes" && (
                  <div>
                    <SectionCard title="Pastoral Notes">
                      {detail.notes ? <div style={{fontSize:13,lineHeight:1.7,color:TX,padding:"4px 0"}}>{detail.notes}</div> : <div style={{fontSize:12,color:MU,fontStyle:"italic"}}>No notes yet. Click Edit Profile to add.</div>}
                    </SectionCard>
                    <SectionCard title="AI Follow-Up Generator">
                      <Btn onClick={genFollow} v="ai" style={{width:"100%",justifyContent:"center",marginBottom:10}}>{aiLoad?"Generating message...":"Generate AI Follow-Up"}</Btn>
                      <div style={{minHeight:90,fontSize:13,lineHeight:1.7,color:aiMsg?TX:MU,fontStyle:aiMsg?"normal":"italic",background:BG,borderRadius:8,padding:12,border:"0.5px solid "+BR,whiteSpace:"pre-wrap"}}>{aiMsg||"Your personalized pastoral message will appear here."}</div>
                      {aiMsg && (
                        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                          <Btn onClick={()=>navigator.clipboard.writeText(aiMsg)} v="gold" style={{flex:1,minWidth:80,justifyContent:"center",fontSize:12}}>Copy</Btn>
                          {detail.phone && <a href={"sms:"+detail.phone+"&body="+encodeURIComponent(aiMsg)} style={{flex:1,minWidth:80,textDecoration:"none"}}><Btn v="primary" style={{width:"100%",justifyContent:"center",fontSize:12}}>Text</Btn></a>}
                          {detail.email && <Btn onClick={()=>window.__openEmailComposer__&&window.__openEmailComposer__({to:detail.email,toName:detail.first+" "+detail.last,subject:"A Note from Pastor",body:aiMsg,category:"Pastoral Message",relatedType:detail._type,relatedId:detail.id})} v="outline" style={{flex:1,minWidth:80,justifyContent:"center",fontSize:12}}>Email</Btn>}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                )}
              </div>
            )}

            {/* EDIT MODE */}
            {editMode && (
              <div>
                <div style={{background:GL,border:"0.5px solid "+G,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#7a5c10"}}>
                  <span style={{fontWeight:600}}>Edit Mode</span> — All fields below are editable. Click Save when done.
                </div>
                <SectionCard title="Basic Information">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="First Name *"><Inp value={editForm.first||""} onChange={ef("first")}/></Fld>
                    <Fld label="Last Name *"><Inp value={editForm.last||""} onChange={ef("last")}/></Fld>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Phone"><Inp value={editForm.phone||""} onChange={ef("phone")}/></Fld>
                    <Fld label="Email"><Inp value={editForm.email||""} onChange={ef("email")}/></Fld>
                  </div>
                  {detail._type==="members" ? (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      <Fld label="Status"><Slt value={editForm.status||"Active"} onChange={ef("status")} opts={["Active","Inactive"]}/></Fld>
                      <Fld label="Role"><Inp value={editForm.role||""} onChange={ef("role")}/></Fld>
                      <Fld label="Member Since"><Inp type="date" value={editForm.joined||""} onChange={ef("joined")}/></Fld>
                    </div>
                  ) : (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      <Fld label="Stage"><Slt value={editForm.stage||"First Visit"} onChange={ef("stage")} opts={["First Visit","Follow-Up Needed","Returning","Prospect","Member"]}/></Fld>
                      <Fld label="Sponsor"><Inp value={editForm.sponsor||""} onChange={ef("sponsor")}/></Fld>
                      <Fld label="First Visit"><Inp type="date" value={editForm.firstVisit||""} onChange={ef("firstVisit")}/></Fld>
                    </div>
                  )}
                  <Fld label="Family Name"><Inp value={editForm.family||""} onChange={ef("family")} placeholder="Lee Household"/></Fld>
                </SectionCard>

                <SectionCard title="Address">
                  <Fld label="Street"><Inp value={(editForm.address||{}).street||""} onChange={efa("street")} placeholder="1234 W Example Ave"/></Fld>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
                    <Fld label="City"><Inp value={(editForm.address||{}).city||""} onChange={efa("city")}/></Fld>
                    <Fld label="State"><Inp value={(editForm.address||{}).state||""} onChange={efa("state")}/></Fld>
                    <Fld label="Zip"><Inp value={(editForm.address||{}).zip||""} onChange={efa("zip")}/></Fld>
                  </div>
                </SectionCard>

                <SectionCard title="Important Dates">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Birthday"><Inp type="date" value={editForm.birthday||""} onChange={ef("birthday")}/></Fld>
                    <Fld label="Anniversary"><Inp type="date" value={editForm.anniversary||""} onChange={ef("anniversary")}/></Fld>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Salvation Date"><Inp type="date" value={editForm.salvationDate||""} onChange={ef("salvationDate")}/></Fld>
                    <Fld label="Baptism Date"><Inp type="date" value={editForm.baptismDate||""} onChange={ef("baptismDate")}/></Fld>
                  </div>
                </SectionCard>

                <SectionCard title="Occupation">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Occupation"><Inp value={editForm.occupation||""} onChange={ef("occupation")} placeholder="Teacher, Carpenter..."/></Fld>
                    <Fld label="Employer"><Inp value={editForm.employer||""} onChange={ef("employer")} placeholder="Company name"/></Fld>
                  </div>
                </SectionCard>

                <SectionCard title="Emergency Contact">
                  <Fld label="Name"><Inp value={editForm.emergencyName||""} onChange={ef("emergencyName")}/></Fld>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Phone"><Inp value={editForm.emergencyPhone||""} onChange={ef("emergencyPhone")}/></Fld>
                    <Fld label="Relationship"><Inp value={editForm.emergencyRelation||""} onChange={ef("emergencyRelation")} placeholder="Wife, Son..."/></Fld>
                  </div>
                </SectionCard>

                <SectionCard title="Family">
                  <Fld label="Spouse Name"><Inp value={editForm.spouseName||""} onChange={ef("spouseName")}/></Fld>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,marginBottom:6}}>
                    <span style={{fontSize:11,color:MU,fontWeight:500}}>Children</span>
                    <button onClick={addChild} style={{background:GR+"18",border:"0.5px solid "+GR+"55",borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:GR,fontWeight:500}}>+ Add Child</button>
                  </div>
                  {(editForm.children||[]).length===0 && <div style={{fontSize:11,color:MU,fontStyle:"italic"}}>No children added yet.</div>}
                  {(editForm.children||[]).map((c,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,marginBottom:6,alignItems:"center"}}>
                      <Inp value={c.name} onChange={v=>updChild(i,"name",v)} placeholder="Child name"/>
                      <Inp type="date" value={c.birthday||""} onChange={v=>updChild(i,"birthday",v)}/>
                      <button onClick={()=>remChild(i)} style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:6,padding:"6px 10px",cursor:"pointer",color:RE,fontSize:11,fontWeight:500}}>X</button>
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title="Medical and Allergies">
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:MU,marginBottom:5,fontWeight:500}}>Allergies</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {CALLERGIES.map(a=>{const on=(editForm.allergies||[]).includes(a);return <div key={a} onClick={()=>toggleArr("allergies",a)} style={{fontSize:11,padding:"3px 9px",borderRadius:20,cursor:"pointer",userSelect:"none",background:on?"#fee2e2":BG,color:on?RE:MU,border:"0.5px solid "+(on?"#fca5a5":BR),fontWeight:on?500:400}}>{a}</div>;})}
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:MU,marginBottom:5,fontWeight:500}}>Conditions</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {CMEDICAL.map(m=>{const on=(editForm.medical||[]).includes(m);return <div key={m} onClick={()=>toggleArr("medical",m)} style={{fontSize:11,padding:"3px 9px",borderRadius:20,cursor:"pointer",userSelect:"none",background:on?"#eff6ff":BG,color:on?BL:MU,border:"0.5px solid "+(on?BL+"55":BR),fontWeight:on?500:400}}>{m}</div>;})}
                    </div>
                  </div>
                  <Fld label="Medical Notes"><Inp value={editForm.medicalNotes||""} onChange={ef("medicalNotes")} placeholder="Medications, emergency notes..."/></Fld>
                </SectionCard>

                <SectionCard title="Pastoral Notes">
                  <textarea value={editForm.notes||""} onChange={e=>ef("notes")(e.target.value)} rows={4} placeholder="Pastoral observations, follow-up notes..." style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
                </SectionCard>

                <div style={{display:"flex",gap:8,marginTop:14,position:"sticky",bottom:0,background:W,paddingTop:10,borderTop:"0.5px solid "+BR}}>
                  <Btn onClick={saveEdit} v="success" style={{flex:1,justifyContent:"center"}}>Save Changes</Btn>
                  <Btn onClick={()=>{setEditMode(false);setEditForm({...detail});}} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── ATTENDANCE ──
function Attendance({attendance,setAttendance,setView}:any) {
  const [modal,setModal] = useState(false);
  const [form,setForm] = useState({date:td(),service:"Sunday Morning Worship",count:"",members:"",visitors:"",notes:""});
  const [insight,setInsight] = useState("");
  const [load,setLoad] = useState(false);
  const nid = useRef(300);
  const sf = k => v => setForm(f=>({...f,[k]:v}));
  const save = () => {
    if(!form.date||!form.count){alert("Date and count required.");return;}
    setAttendance([{...form,count:+form.count,members:+form.members||0,visitors:+form.visitors||0,id:nid.current++},...attendance]);
    setModal(false);
    setForm({date:td(),service:"Sunday Morning Worship",count:"",members:"",visitors:"",notes:""});
  };
  const genAi = async () => {
    setLoad(true);
    const data = attendance.slice(0,6).map(a=>a.date+": "+a.service+" "+a.count+" ("+a.members+"M/"+a.visitors+"V)").join(", ");
    const txt = await callAI([{role:"user",content:"Analyze NTCC attendance for Pastor Hall in 2-3 sentences: "+data}],[],[],[],[],[],{});
    setInsight(txt); setLoad(false);
  };
  const avg = attendance.length ? Math.round(attendance.reduce((a,s)=>a+s.count,0)/attendance.length) : 0;
  const best = [...attendance].sort((a,b)=>b.count-a.count)[0]||{count:0,service:""};
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:20}}>
        <Stat label="Services" value={attendance.length}/>
        <Stat label="Avg Attendance" value={avg} color={BL}/>
        <Stat label="Best Service" value={best.count} sub={best.service} color={GR}/>
        <Stat label="Total Visitors" value={attendance.reduce((a,s)=>a+s.visitors,0)} color={AM}/>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>AI Attendance Analysis</h3>
          <Btn onClick={genAi} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{load?"Analyzing...":"Analyze Trends"}</Btn>
        </div>
        <p style={{fontSize:13,lineHeight:1.7,color:insight?TX:MU,fontStyle:insight?"normal":"italic",margin:0}}>{insight||"Click Analyze Trends for AI-powered attendance insights, Pastor Hall."}</p>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Service Log</h3>
        <div style={{display:"flex",gap:8}}>
          {setView && <Btn onClick={()=>setView("addperson")} v="gold" style={{fontSize:12}}>+ Add New Person</Btn>}
          <Btn onClick={()=>setModal(true)}>+ Log Service</Btn>
        </div>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f8f9fc"}}>
              {["Date","Service","Total","Members","Visitors","Notes",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {attendance.map(a=>(
              <tr key={a.id} style={{borderBottom:"0.5px solid "+BR}}>
                <td style={{padding:"10px 14px",fontSize:13,fontWeight:500}}>{fd(a.date)}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{a.service}</td>
                <td style={{padding:"10px 14px",fontSize:15,fontWeight:500,color:N}}>{a.count}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:GR}}>{a.members}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:AM}}>{a.visitors}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:MU}}>{a.notes||"None"}</td>
                <td style={{padding:"10px 14px"}}><Btn onClick={()=>setAttendance(attendance.filter(s=>s.id!==a.id))} v="danger" style={{fontSize:11,padding:"3px 8px"}}>X</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Log New Service">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Date *"><Inp type="date" value={form.date} onChange={sf("date")}/></Fld>
          <Fld label="Service Type"><Slt value={form.service} onChange={sf("service")} opts={["Sunday Morning Worship","Sunday Evening Service","Wednesday Bible Study","Special Event","Youth Service","Prayer Meeting"]}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fld label="Total *"><Inp type="number" value={form.count} onChange={sf("count")} placeholder="0"/></Fld>
          <Fld label="Members"><Inp type="number" value={form.members} onChange={sf("members")} placeholder="0"/></Fld>
          <Fld label="Visitors"><Inp type="number" value={form.visitors} onChange={sf("visitors")} placeholder="0"/></Fld>
        </div>
        <Fld label="Notes"><Inp value={form.notes} onChange={sf("notes")} placeholder="Any notable details..."/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1,justifyContent:"center"}}>Save Service</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── GIVING ──
function PledgeDrives({pledgeDrives,setPledgeDrives,pledges,setPledges,giving,members,visitors}){
  const [view,setView] = useState("list");
  const [selDrive,setSelDrive] = useState(null);
  const [driveModal,setDriveModal] = useState(false);
  const [editDrive,setEditDrive] = useState(null);
  const [pledgeModal,setPledgeModal] = useState(false);
  const [editPledge,setEditPledge] = useState(null);
  const [paySearch,setPaySearch] = useState("");
  const [pledgerSearch,setPledgerSearch] = useState("");
  const [showPledger,setShowPledger] = useState(false);

  const [driveForm,setDriveForm] = useState({name:"",description:"",goal:"",category:"",startDate:td(),endDate:"",status:"Active"});
  const [pledgeForm,setPledgeForm] = useState({pledgerId:null,pledgerType:"member",pledgerName:"",amount:"",type:"onetime",frequency:"Monthly",installmentAmount:"",pledgeDate:td(),targetDate:"",notes:""});

  const nid = useRef(1000);
  const allPeople = [...members.map(m=>({...m,_type:"member"})),...visitors.map(v=>({...v,_type:"visitor"}))];

  // Auto-sync: compute paid amount from giving records matching this pledger + drive category
  const getPaidFromGiving = (pledge, drive) => {
    if(!drive.category) return 0;
    return giving.filter(g =>
      g.name === pledge.pledgerName &&
      g.category === drive.category &&
      g.date >= drive.startDate &&
      (!drive.endDate || g.date <= drive.endDate)
    ).reduce((a,g)=>a+g.amount, 0);
  };

  const getLinkedGiving = (pledge, drive) => {
    if(!drive.category) return [];
    return giving.filter(g =>
      g.name === pledge.pledgerName &&
      g.category === drive.category &&
      g.date >= drive.startDate &&
      (!drive.endDate || g.date <= drive.endDate)
    ).sort((a,b)=>b.date.localeCompare(a.date));
  };

  const driveStats = (drive) => {
    const drivePledges = pledges.filter(p=>p.driveId===drive.id);
    const totalPledged = drivePledges.reduce((a,p)=>a+ +p.amount, 0);
    const totalPaid = drivePledges.reduce((a,p)=>a+getPaidFromGiving(p,drive), 0);
    const balance = totalPledged - totalPaid;
    const goalProgress = drive.goal ? Math.round(totalPaid/+drive.goal*100) : 0;
    const pledgeProgress = drive.goal ? Math.round(totalPledged/+drive.goal*100) : 0;
    const fullyPaid = drivePledges.filter(p=>getPaidFromGiving(p,drive)>=+p.amount).length;
    const partiallyPaid = drivePledges.filter(p=>{const pd=getPaidFromGiving(p,drive);return pd>0&&pd<+p.amount;}).length;
    const unpaid = drivePledges.filter(p=>getPaidFromGiving(p,drive)===0).length;
    return {drivePledges,totalPledged,totalPaid,balance,goalProgress,pledgeProgress,fullyPaid,partiallyPaid,unpaid};
  };

  const openAddDrive = () => { setEditDrive(null); setDriveForm({name:"",description:"",goal:"",category:"",startDate:td(),endDate:"",status:"Active"}); setDriveModal(true); };
  const openEditDrive = d => { setEditDrive(d); setDriveForm({name:d.name,description:d.description||"",goal:d.goal,category:d.category,startDate:d.startDate,endDate:d.endDate||"",status:d.status}); setDriveModal(true); };
  const saveDrive = () => {
    if(!driveForm.name||!driveForm.goal||!driveForm.category){alert("Name, goal, and category required.");return;}
    if(editDrive) setPledgeDrives(ds=>ds.map(d=>d.id===editDrive.id?{...d,...driveForm,goal:+driveForm.goal}:d));
    else setPledgeDrives(ds=>[...ds,{...driveForm,goal:+driveForm.goal,id:nid.current++}]);
    setDriveModal(false);
  };
  const delDrive = id => { if(confirm("Delete drive and all its pledges?")){setPledgeDrives(ds=>ds.filter(d=>d.id!==id));setPledges(ps=>ps.filter(p=>p.driveId!==id));setSelDrive(null);setView("list");} };

  const openAddPledge = () => { setEditPledge(null); setPledgeForm({pledgerId:null,pledgerType:"member",pledgerName:"",amount:"",type:"onetime",frequency:"Monthly",installmentAmount:"",pledgeDate:td(),targetDate:"",notes:""}); setPledgerSearch(""); setPledgeModal(true); };
  const openEditPledge = p => { setEditPledge(p); setPledgeForm({...p,amount:String(p.amount),installmentAmount:String(p.installmentAmount||"")}); setPledgerSearch(p.pledgerName); setPledgeModal(true); };
  const savePledge = () => {
    if(!pledgeForm.pledgerName||!pledgeForm.amount){alert("Pledger name and amount required.");return;}
    const data = {...pledgeForm,amount:+pledgeForm.amount,installmentAmount:+pledgeForm.installmentAmount||0,driveId:selDrive.id};
    if(editPledge) setPledges(ps=>ps.map(p=>p.id===editPledge.id?{...p,...data}:p));
    else setPledges(ps=>[...ps,{...data,id:nid.current++}]);
    setPledgeModal(false);
  };
  const delPledge = id => { if(confirm("Delete this pledge?")) setPledges(ps=>ps.filter(p=>p.id!==id)); };

  const pledgerResults = pledgerSearch.trim().length>1 ? allPeople.filter(p=>(p.first+" "+p.last).toLowerCase().includes(pledgerSearch.toLowerCase())).slice(0,6) : [];

  // === LIST VIEW ===
  if(view==="list"){
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Pledge Drives</h3>
          <Btn onClick={openAddDrive} v="gold">+ Create Pledge Drive</Btn>
        </div>
        {pledgeDrives.length===0 ? (
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
            <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>No pledge drives yet</h3>
            <p style={{fontSize:13,color:MU,marginBottom:16}}>Create your first drive to start tracking commitments and payments.</p>
            <Btn onClick={openAddDrive} v="gold">+ Create Your First Drive</Btn>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
            {pledgeDrives.map(d=>{
              const s = driveStats(d);
              return (
                <div key={d.id} onClick={()=>{setSelDrive(d);setView("detail");}} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,cursor:"pointer",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px #00000015"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,color:N}}>{d.name}</div>
                      <div style={{fontSize:11,color:MU,marginTop:2}}>Goal: {f$(d.goal)} - {s.drivePledges.length} pledger{s.drivePledges.length!==1?"s":""}</div>
                    </div>
                    <span style={{fontSize:10,background:d.status==="Active"?"#dcfce7":"#f5f5f5",color:d.status==="Active"?GR:MU,borderRadius:10,padding:"2px 8px",fontWeight:500}}>{d.status}</span>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                      <span style={{color:MU}}>Paid</span>
                      <span style={{fontWeight:500,color:GR}}>{f$(s.totalPaid)} / {f$(d.goal)}</span>
                    </div>
                    <div style={{height:8,background:BG,borderRadius:4,overflow:"hidden",position:"relative"}}>
                      <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(s.pledgeProgress,100)+"%",background:G+"44"}}></div>
                      <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(s.goalProgress,100)+"%",background:GR}}></div>
                    </div>
                    <div style={{fontSize:10,color:MU,marginTop:3,display:"flex",justifyContent:"space-between"}}>
                      <span>{s.goalProgress}% paid</span>
                      <span>{s.pledgeProgress}% pledged</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,padding:"6px 8px",background:"#f0fdf4",borderRadius:6,textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:GR}}>{s.fullyPaid}</div><div style={{fontSize:9,color:MU,textTransform:"uppercase"}}>Paid</div></div>
                    <div style={{flex:1,padding:"6px 8px",background:"#fef9c3",borderRadius:6,textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:"#854d0e"}}>{s.partiallyPaid}</div><div style={{fontSize:9,color:MU,textTransform:"uppercase"}}>Partial</div></div>
                    <div style={{flex:1,padding:"6px 8px",background:"#fee2e2",borderRadius:6,textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:RE}}>{s.unpaid}</div><div style={{fontSize:9,color:MU,textTransform:"uppercase"}}>Unpaid</div></div>
                  </div>
                  <div style={{fontSize:10,color:MU,marginTop:10,paddingTop:10,borderTop:"0.5px solid "+BR}}>Category: <strong>{d.category}</strong> - Balance: <strong>{f$(s.balance)}</strong></div>
                </div>
              );
            })}
          </div>
        )}
        <Modal open={driveModal} onClose={()=>setDriveModal(false)} title={editDrive?"Edit Pledge Drive":"Create Pledge Drive"}>
          <Fld label="Drive Name *"><Inp value={driveForm.name} onChange={v=>setDriveForm(f=>({...f,name:v}))} placeholder="e.g. Building Fund 2026"/></Fld>
          <Fld label="Description"><Inp value={driveForm.description} onChange={v=>setDriveForm(f=>({...f,description:v}))} placeholder="Purpose of this drive..."/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Fld label="Goal Amount *"><Inp type="number" value={driveForm.goal} onChange={v=>setDriveForm(f=>({...f,goal:v}))} placeholder="50000"/></Fld>
            <Fld label="Giving Category *"><Slt value={driveForm.category} onChange={v=>setDriveForm(f=>({...f,category:v}))} opts={[{v:"",l:"Select category"},"Building Fund","Missions","Special Gift","Tithe","Offering"]}/></Fld>
          </div>
          <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11,color:BL,lineHeight:1.6}}>
            <strong>Auto-Sync:</strong> Any Giving record matching this category (within the date range) will automatically count toward the drive and the pledger's balance.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Fld label="Start Date *"><Inp type="date" value={driveForm.startDate} onChange={v=>setDriveForm(f=>({...f,startDate:v}))}/></Fld>
            <Fld label="End Date (optional)"><Inp type="date" value={driveForm.endDate} onChange={v=>setDriveForm(f=>({...f,endDate:v}))}/></Fld>
          </div>
          <Fld label="Status"><Slt value={driveForm.status} onChange={v=>setDriveForm(f=>({...f,status:v}))} opts={["Active","Closed","Archived"]}/></Fld>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={saveDrive} v="gold" style={{flex:1,justifyContent:"center"}}>Save Drive</Btn>
            <Btn onClick={()=>setDriveModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
          </div>
        </Modal>
      </div>
    );
  }

  // === DETAIL VIEW ===
  const s = driveStats(selDrive);
  const filteredPledges = paySearch ? s.drivePledges.filter(p=>p.pledgerName.toLowerCase().includes(paySearch.toLowerCase())) : s.drivePledges;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>{setView("list");setSelDrive(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:N,fontWeight:500,padding:0}}>{"<"} All Drives</button>
        <div style={{flex:1}}></div>
        <Btn onClick={()=>openEditDrive(selDrive)} v="ghost" style={{fontSize:12}}>Edit Drive</Btn>
        <Btn onClick={()=>delDrive(selDrive.id)} v="danger" style={{fontSize:12}}>Delete</Btn>
      </div>

      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:11,color:G,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:4}}>Pledge Drive</div>
            <h2 style={{fontSize:22,fontWeight:500,color:N,margin:0}}>{selDrive.name}</h2>
            {selDrive.description && <p style={{fontSize:13,color:MU,margin:"4px 0 0"}}>{selDrive.description}</p>}
            <div style={{fontSize:11,color:MU,marginTop:8}}>Category: <strong>{selDrive.category}</strong> - {fd(selDrive.startDate)}{selDrive.endDate?" to "+fd(selDrive.endDate):" (ongoing)"}</div>
          </div>
          <span style={{fontSize:11,background:selDrive.status==="Active"?"#dcfce7":"#f5f5f5",color:selDrive.status==="Active"?GR:MU,borderRadius:20,padding:"3px 11px",fontWeight:500}}>{selDrive.status}</span>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
            <span style={{color:MU}}>Progress toward goal</span>
            <span style={{fontWeight:600,color:N}}>{f$(s.totalPaid)} / {f$(selDrive.goal)}</span>
          </div>
          <div style={{height:14,background:BG,borderRadius:7,overflow:"hidden",position:"relative",border:"0.5px solid "+BR}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(s.pledgeProgress,100)+"%",background:G+"55"}}></div>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(s.goalProgress,100)+"%",background:GR}}></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:MU,marginTop:4}}>
            <span><span style={{display:"inline-block",width:8,height:8,background:GR,borderRadius:2,marginRight:4}}></span>Paid: {s.goalProgress}%</span>
            <span><span style={{display:"inline-block",width:8,height:8,background:G+"55",borderRadius:2,marginRight:4}}></span>Pledged: {s.pledgeProgress}%</span>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Stat label="Pledged" value={f$(s.totalPledged)} sub={s.drivePledges.length+" commitments"} color={G}/>
        <Stat label="Paid" value={f$(s.totalPaid)} sub="Auto-synced from giving" color={GR}/>
        <Stat label="Balance" value={f$(s.balance)} sub="Still owed" color={s.balance>0?AM:GR}/>
        <Stat label="Goal Gap" value={f$(Math.max(0,selDrive.goal-s.totalPaid))} sub="To reach goal" color={selDrive.goal-s.totalPaid<=0?GR:RE}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:10,flexWrap:"wrap"}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Pledgers ({s.drivePledges.length})</h3>
        <input value={paySearch} onChange={e=>setPaySearch(e.target.value)} placeholder="Search pledgers..." style={{flex:1,minWidth:200,padding:"7px 11px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none"}}/>
        <Btn onClick={openAddPledge} v="gold">+ Record Pledge</Btn>
      </div>

      {s.drivePledges.length===0 ? (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU,fontSize:13}}>No pledges yet. Click "Record Pledge" to add the first commitment.</div>
      ) : (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8f9fc"}}>{["Pledger","Pledged","Paid","Balance","Type","Status",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
            <tbody>
              {filteredPledges.map(p=>{
                const paid = getPaidFromGiving(p, selDrive);
                const bal = +p.amount - paid;
                const linked = getLinkedGiving(p, selDrive);
                const st = paid>=+p.amount ? "Fully Paid" : paid>0 ? "Partial" : "Unpaid";
                const stColor = paid>=+p.amount ? GR : paid>0 ? "#854d0e" : RE;
                const stBg = paid>=+p.amount ? "#dcfce7" : paid>0 ? "#fef9c3" : "#fee2e2";
                const [first,...rest] = p.pledgerName.split(" ");
                return (
                  <tr key={p.id} style={{borderBottom:"0.5px solid "+BR}}>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Av f={first} l={rest.join(" ")||" "} sz={30}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:500}}>{p.pledgerName}</div>
                          <div style={{fontSize:11,color:MU}}>{p.pledgerType==="member"?"Member":p.pledgerType==="visitor"?"Visitor":"Guest"} - Pledged {fd(p.pledgeDate)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500}}>{f$(p.amount)}</td>
                    <td style={{padding:"10px 14px",fontSize:13,color:GR,fontWeight:500}}>{f$(paid)}{linked.length>0 && <span style={{fontSize:10,color:MU,fontWeight:400,marginLeft:5}}>({linked.length} gift{linked.length!==1?"s":""})</span>}</td>
                    <td style={{padding:"10px 14px",fontSize:13,color:bal>0?AM:GR,fontWeight:500}}>{f$(Math.max(0,bal))}</td>
                    <td style={{padding:"10px 14px",fontSize:12}}>{p.type==="installment"?p.frequency+" "+f$(p.installmentAmount):"One-time"}</td>
                    <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:stBg,color:stColor,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{st}</span></td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <Btn onClick={()=>openEditPledge(p)} v="ghost" style={{fontSize:11,padding:"3px 7px"}}>Edit</Btn>
                        <Btn onClick={()=>delPledge(p.id)} v="danger" style={{fontSize:11,padding:"3px 7px"}}>X</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={pledgeModal} onClose={()=>setPledgeModal(false)} title={editPledge?"Edit Pledge":"Record New Pledge"} width={500}>
        <Fld label="Pledger *">
          {editPledge ? (
            <Inp value={pledgeForm.pledgerName} onChange={v=>setPledgeForm(f=>({...f,pledgerName:v}))}/>
          ) : (
            <div style={{position:"relative"}}>
              <input value={pledgerSearch} onChange={e=>{setPledgerSearch(e.target.value);setShowPledger(true);setPledgeForm(f=>({...f,pledgerName:e.target.value,pledgerId:null,pledgerType:"guest"}));}} onFocus={()=>setShowPledger(true)} onBlur={()=>setTimeout(()=>setShowPledger(false),180)} placeholder="Search member/visitor or type name..." style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              {showPledger && pledgerResults.length>0 && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:W,border:"0.5px solid "+BR,borderRadius:8,zIndex:20,boxShadow:"0 4px 12px #00000018",marginTop:2,maxHeight:180,overflowY:"auto"}}>
                  {pledgerResults.map(p=>(
                    <div key={p._type+p.id} onMouseDown={()=>{setPledgeForm(f=>({...f,pledgerId:p.id,pledgerType:p._type,pledgerName:p.first+" "+p.last}));setPledgerSearch(p.first+" "+p.last);setShowPledger(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,borderBottom:"0.5px solid "+BR,display:"flex",alignItems:"center",gap:8}}>
                      <Av f={p.first} l={p.last} sz={24}/>
                      <div style={{flex:1}}><div style={{fontWeight:500}}>{p.first} {p.last}</div><div style={{fontSize:10,color:MU}}>{p._type==="member"?"Member":"Visitor"}{p.phone?" - "+p.phone:""}</div></div>
                    </div>
                  ))}
                  {pledgerSearch && <div onMouseDown={()=>{setPledgeForm(f=>({...f,pledgerName:pledgerSearch,pledgerId:null,pledgerType:"guest"}));setShowPledger(false);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:N,fontWeight:500,borderTop:"0.5px solid "+BR}}>Use "{pledgerSearch}" as guest pledger</div>}
                </div>
              )}
            </div>
          )}
        </Fld>
        <Fld label="Pledge Amount *"><Inp type="number" value={pledgeForm.amount} onChange={v=>setPledgeForm(f=>({...f,amount:v}))} placeholder="1000"/></Fld>
        <Fld label="Commitment Type">
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setPledgeForm(f=>({...f,type:"onetime"}))} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid "+(pledgeForm.type==="onetime"?N:BR),background:pledgeForm.type==="onetime"?N:W,color:pledgeForm.type==="onetime"?"#fff":TX,fontSize:13,cursor:"pointer",fontWeight:pledgeForm.type==="onetime"?500:400}}>One-Time Lump Sum</button>
            <button onClick={()=>setPledgeForm(f=>({...f,type:"installment"}))} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid "+(pledgeForm.type==="installment"?N:BR),background:pledgeForm.type==="installment"?N:W,color:pledgeForm.type==="installment"?"#fff":TX,fontSize:13,cursor:"pointer",fontWeight:pledgeForm.type==="installment"?500:400}}>Installments</button>
          </div>
        </Fld>
        {pledgeForm.type==="installment" && (
          <div style={{background:BG,borderRadius:8,padding:12,marginBottom:12,border:"0.5px solid "+BR}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Fld label="Frequency"><Slt value={pledgeForm.frequency} onChange={v=>setPledgeForm(f=>({...f,frequency:v}))} opts={["Weekly","Bi-Weekly","Monthly","Quarterly","Annually"]}/></Fld>
              <Fld label="Per Installment"><Inp type="number" value={pledgeForm.installmentAmount} onChange={v=>setPledgeForm(f=>({...f,installmentAmount:v}))} placeholder="100"/></Fld>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Pledge Date"><Inp type="date" value={pledgeForm.pledgeDate} onChange={v=>setPledgeForm(f=>({...f,pledgeDate:v}))}/></Fld>
          <Fld label="Complete By (optional)"><Inp type="date" value={pledgeForm.targetDate} onChange={v=>setPledgeForm(f=>({...f,targetDate:v}))}/></Fld>
        </div>
        <Fld label="Notes"><Inp value={pledgeForm.notes} onChange={v=>setPledgeForm(f=>({...f,notes:v}))}/></Fld>
        <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11,color:BL,lineHeight:1.6}}>
          <strong>Note:</strong> Payments auto-sync from Giving records matching {selDrive.pledgerName||"the pledger's name"} and category "{selDrive.category}" within the drive's date range.
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={savePledge} v="gold" style={{flex:1,justifyContent:"center"}}>Save Pledge</Btn>
          <Btn onClick={()=>setPledgeModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>

      <Modal open={driveModal} onClose={()=>setDriveModal(false)} title={editDrive?"Edit Pledge Drive":"Create Pledge Drive"}>
        <Fld label="Drive Name *"><Inp value={driveForm.name} onChange={v=>setDriveForm(f=>({...f,name:v}))}/></Fld>
        <Fld label="Description"><Inp value={driveForm.description} onChange={v=>setDriveForm(f=>({...f,description:v}))}/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Goal Amount *"><Inp type="number" value={driveForm.goal} onChange={v=>setDriveForm(f=>({...f,goal:v}))}/></Fld>
          <Fld label="Giving Category *"><Slt value={driveForm.category} onChange={v=>setDriveForm(f=>({...f,category:v}))} opts={[{v:"",l:"Select category"},"Building Fund","Missions","Special Gift","Tithe","Offering"]}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Start Date *"><Inp type="date" value={driveForm.startDate} onChange={v=>setDriveForm(f=>({...f,startDate:v}))}/></Fld>
          <Fld label="End Date"><Inp type="date" value={driveForm.endDate} onChange={v=>setDriveForm(f=>({...f,endDate:v}))}/></Fld>
        </div>
        <Fld label="Status"><Slt value={driveForm.status} onChange={v=>setDriveForm(f=>({...f,status:v}))} opts={["Active","Closed","Archived"]}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={saveDrive} v="gold" style={{flex:1,justifyContent:"center"}}>Save</Btn>
          <Btn onClick={()=>setDriveModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// Tithe calculation helpers
// Church Tithe = 10% of everything NOT 'Tithe' and NOT 'Sunday Morning Offering'
// Pastor's Draw = 60% of Tithe + Sunday Morning Offering (weekly)
function calcTithes(givingRecords:any){
  const tithe = givingRecords.filter((g:any)=>g.category==="Tithe").reduce((a:number,g:any)=>a+g.amount,0);
  const sundayMorning = givingRecords.filter((g:any)=>g.category==="Sunday Morning Offering").reduce((a:number,g:any)=>a+g.amount,0);
  const otherOfferings = givingRecords.filter((g:any)=>g.category!=="Tithe"&&g.category!=="Sunday Morning Offering").reduce((a:number,g:any)=>a+g.amount,0);
  const pastorBase = tithe + sundayMorning;
  return {
    tithe,
    sundayMorning,
    otherOfferings,
    pastorBase,
    churchBase: otherOfferings,
    pastorDraw: Math.round(pastorBase * 0.60 * 100) / 100,
    pastorTithe: Math.round(pastorBase * 0.60 * 100) / 100, // alias for backward compat
    churchTithe: Math.round(otherOfferings * 0.10 * 100) / 100
  };
}

// ── WEEKLY GIVING REPORTS ──
// Week = Monday to Sunday. Helper: get Monday of week containing a date.
function getMondayOf(dateStr){
  const d = new Date(dateStr+"T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // if Sunday, go back 6; else go back (day-1)
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}
function getSundayOf(mondayStr){
  const d = new Date(mondayStr+"T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}
function computeWeekReport(mondayStr, giving){
  const sunday = getSundayOf(mondayStr);
  const weekGiving = giving.filter(g=>g.date>=mondayStr && g.date<=sunday);
  const byCategory = {};
  const byMethod = {};
  weekGiving.forEach(g=>{
    byCategory[g.category] = (byCategory[g.category]||0) + g.amount;
    byMethod[g.method] = (byMethod[g.method]||0) + g.amount;
  });
  const tithes = calcTithes(weekGiving);
  return {
    weekStart: mondayStr,
    weekEnd: sunday,
    total: weekGiving.reduce((a,g)=>a+g.amount,0),
    count: weekGiving.length,
    byCategory,
    byMethod,
    uniqueGivers: new Set(weekGiving.map(g=>g.name)).size,
    tithes
  };
}

function WeeklyReports({giving,weeklyReports,setWeeklyReports}){
  const [viewReport,setViewReport] = useState(null);

  // Auto-save: generate reports for all Mondays with giving activity that aren't yet saved
  useEffect(()=>{
    if(giving.length===0) return;
    const mondays = new Set(giving.map(g=>getMondayOf(g.date)));
    const existing = new Set(weeklyReports.map(r=>r.weekStart));
    const newReports = [];
    mondays.forEach(m=>{
      if(!existing.has(m)){
        const data = computeWeekReport(m, giving);
        newReports.push({id:"wr_"+m,generated:new Date().toISOString(),auto:true,...data});
      }
    });
    if(newReports.length>0) setWeeklyReports(rs=>[...rs,...newReports]);
  // eslint-disable-next-line
  },[giving.length]);

  const sortedReports = [...weeklyReports].sort((a,b)=>b.weekStart.localeCompare(a.weekStart));
  const todayMonday = getMondayOf(td());
  const currentWeekExists = weeklyReports.some(r=>r.weekStart===todayMonday);

  const regenerate = (mondayStr) => {
    const data = computeWeekReport(mondayStr, giving);
    const existing = weeklyReports.find(r=>r.weekStart===mondayStr);
    if(existing){
      setWeeklyReports(rs=>rs.map(r=>r.weekStart===mondayStr?{...r,...data,generated:new Date().toISOString(),auto:false}:r));
    } else {
      setWeeklyReports(rs=>[...rs,{id:"wr_"+mondayStr,generated:new Date().toISOString(),auto:false,...data}]);
    }
    // Refresh the open report view if it's the one being regenerated
    if(viewReport && viewReport.weekStart===mondayStr){
      setViewReport({...viewReport,...data,generated:new Date().toISOString(),auto:false});
    }
  };

  const delReport = id => {
    if(!confirm("Delete this weekly report? It will regenerate automatically.")) return;
    setWeeklyReports(rs=>rs.filter(r=>r.id!==id));
    if(viewReport?.id===id) setViewReport(null);
  };

  const generateCurrentWeek = () => regenerate(todayMonday);

  // === DETAIL VIEW ===
  if(viewReport){
    const r = viewReport;
    const catEntries = Object.entries(r.byCategory).sort((a,b)=>b[1]-a[1]);
    const methodEntries = Object.entries(r.byMethod).sort((a,b)=>b[1]-a[1]);
    const maxCat = Math.max(...catEntries.map(([,v])=>v), 1);
    const maxMethod = Math.max(...methodEntries.map(([,v])=>v), 1);
    const gen = new Date(r.generated);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>setViewReport(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:N,fontWeight:500,padding:0}}>{"<"} All Reports</button>
          <div style={{flex:1}}></div>
          <Btn onClick={()=>regenerate(r.weekStart)} v="ai" style={{fontSize:12}}>Regenerate</Btn>
          <Btn onClick={()=>window.print()} v="outline" style={{fontSize:12}}>Print</Btn>
          <Btn onClick={()=>delReport(r.id)} v="danger" style={{fontSize:12}}>Delete</Btn>
        </div>

        <style>{"@media print{body *{visibility:hidden;}.ntcc-report-print,.ntcc-report-print *{visibility:visible;}.ntcc-report-print{position:absolute;left:0;top:0;width:100%;padding:20mm;}.ntcc-no-print{display:none !important;}}"}</style>

        <div className="ntcc-report-print">
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:24,marginBottom:16}}>
            <div style={{textAlign:"center",paddingBottom:16,borderBottom:"1.5px solid "+G,marginBottom:20}}>
              <div style={{fontSize:11,color:G,letterSpacing:2,textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Weekly Giving Report</div>
              <h2 style={{fontSize:22,fontWeight:500,color:N,margin:"0 0 4px"}}>{window.__CS__?.name||"New Testament Christian Church"}</h2>
              <div style={{fontSize:13,color:MU}}>{window.__CS__?.address||"Glendale, AZ"} — {window.__CS__?.pastorName||"Pastor R. E. Hall"}</div>
              <div style={{fontSize:15,fontWeight:500,color:N,marginTop:10}}>Week of {fd(r.weekStart)} — {fd(r.weekEnd)}</div>
              <div style={{fontSize:10,color:MU,marginTop:3}}>{r.auto?"Auto-generated":"Manually regenerated"} on {gen.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} at {gen.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
            </div>

            {/* Top Summary */}
            <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:140,background:GL+"44",border:"0.5px solid "+G,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"#7a5c10",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Week Total</div>
                <div style={{fontSize:28,fontWeight:700,color:N,marginTop:4}}>{f$(r.total)}</div>
              </div>
              <div style={{flex:1,minWidth:100,background:BG,border:"0.5px solid "+BR,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>Records</div>
                <div style={{fontSize:22,fontWeight:500,color:N,marginTop:4}}>{r.count}</div>
              </div>
              <div style={{flex:1,minWidth:100,background:BG,border:"0.5px solid "+BR,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>Unique Givers</div>
                <div style={{fontSize:22,fontWeight:500,color:N,marginTop:4}}>{r.uniqueGivers}</div>
              </div>
              <div style={{flex:1,minWidth:100,background:BG,border:"0.5px solid "+BR,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,color:MU,textTransform:"uppercase",letterSpacing:0.5}}>Avg Gift</div>
                <div style={{fontSize:22,fontWeight:500,color:N,marginTop:4}}>{f$(r.count?Math.round(r.total/r.count):0)}</div>
              </div>
            </div>

            {/* Tithes Section */}
            {r.tithes && (r.tithes.churchTithe>0 || r.tithes.pastorTithe>0) && (
              <div style={{background:"#f8f4e8",border:"1.5px solid "+G,borderRadius:10,padding:"16px 20px",marginBottom:20}}>
                <h3 style={{fontSize:13,fontWeight:600,color:"#7a5c10",margin:"0 0 12px",paddingBottom:6,borderBottom:"0.5px solid "+G+"44",textTransform:"uppercase",letterSpacing:0.5,display:"flex",alignItems:"center",gap:8}}>
                  Tithes Due from This Week
                </h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div style={{background:W,border:"0.5px solid "+G,borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#7a5c10",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Church Weekly Tithe</div>
                    <div style={{fontSize:26,fontWeight:700,color:N,marginBottom:8}}>{f$(r.tithes.churchTithe)}</div>
                    <div style={{fontSize:11,color:MU,lineHeight:1.6}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Base (non-tithe, non-SM offering):</span><strong>{f$(r.tithes.churchBase)}</strong></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>10% of base:</span><strong style={{color:GR}}>{f$(r.tithes.churchTithe)}</strong></div>
                    </div>
                  </div>
                  <div style={{background:W,border:"0.5px solid "+G,borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#7a5c10",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Pastor's Draw</div>
                    <div style={{fontSize:26,fontWeight:700,color:N,marginBottom:8}}>{f$(r.tithes.pastorDraw??r.tithes.pastorTithe)}</div>
                    <div style={{fontSize:11,color:MU,lineHeight:1.6}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Tithe collected:</span><strong>{f$(r.tithes.tithe)}</strong></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Sun. Morning Offering:</span><strong>{f$(r.tithes.sundayMorning)}</strong></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>60% of combined:</span><strong style={{color:GR}}>{f$(r.tithes.pastorDraw??r.tithes.pastorTithe)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown: two columns */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <div>
                <h3 style={{fontSize:13,fontWeight:600,color:N,margin:"0 0 12px",paddingBottom:6,borderBottom:"0.5px solid "+BR,textTransform:"uppercase",letterSpacing:0.5}}>Totals by Category</h3>
                {catEntries.length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic",padding:"12px 0"}}>No giving this week</div> : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {catEntries.map(([cat,amt])=>{
                      const pct = Math.round(amt/maxCat*100);
                      const pctOfTotal = Math.round(amt/r.total*100);
                      return (
                        <div key={cat}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                            <span style={{fontSize:12,fontWeight:500,color:N}}>{cat}</span>
                            <div><span style={{fontSize:13,fontWeight:600,color:GR}}>{f$(amt)}</span><span style={{fontSize:10,color:MU,marginLeft:6}}>{pctOfTotal}%</span></div>
                          </div>
                          <div style={{height:6,background:BG,borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:pct+"%",height:"100%",background:GR,borderRadius:3}}></div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,paddingTop:8,borderTop:"0.5px solid "+BR,marginTop:4}}>
                      <span>Total</span>
                      <span style={{color:GR}}>{f$(r.total)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 style={{fontSize:13,fontWeight:600,color:N,margin:"0 0 12px",paddingBottom:6,borderBottom:"0.5px solid "+BR,textTransform:"uppercase",letterSpacing:0.5}}>Totals by Payment Method</h3>
                {methodEntries.length===0 ? <div style={{fontSize:12,color:MU,fontStyle:"italic",padding:"12px 0"}}>No giving this week</div> : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {methodEntries.map(([meth,amt])=>{
                      const pct = Math.round(amt/maxMethod*100);
                      const pctOfTotal = Math.round(amt/r.total*100);
                      return (
                        <div key={meth}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                            <span style={{fontSize:12,fontWeight:500,color:N}}>{meth}</span>
                            <div><span style={{fontSize:13,fontWeight:600,color:BL}}>{f$(amt)}</span><span style={{fontSize:10,color:MU,marginLeft:6}}>{pctOfTotal}%</span></div>
                          </div>
                          <div style={{height:6,background:BG,borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:pct+"%",height:"100%",background:BL,borderRadius:3}}></div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,paddingTop:8,borderTop:"0.5px solid "+BR,marginTop:4}}>
                      <span>Total</span>
                      <span style={{color:BL}}>{f$(r.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{textAlign:"center",paddingTop:16,borderTop:"0.5px solid "+BR,fontSize:10,color:MU,fontStyle:"italic"}}>
              "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver." — 2 Corinthians 9:7
            </div>
          </div>
        </div>

        <div className="ntcc-no-print" style={{display:"flex",gap:8,justifyContent:"center"}}>
          <Btn onClick={()=>{
            const txt = "NTCC Weekly Giving Report\nWeek of "+fd(r.weekStart)+" to "+fd(r.weekEnd)+"\n\nTotal: "+f$(r.total)+"\nRecords: "+r.count+"\nUnique Givers: "+r.uniqueGivers+"\n\nBy Category:\n"+catEntries.map(([c,a])=>"  "+c+": "+f$(a)).join("\n")+"\n\nBy Method:\n"+methodEntries.map(([m,a])=>"  "+m+": "+f$(a)).join("\n");
            navigator.clipboard.writeText(txt);
            alert("Report copied to clipboard.");
          }} v="gold" style={{fontSize:12}}>Copy as Text</Btn>
        </div>
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Weekly Giving Reports</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Weeks run Monday to Sunday - Auto-saved from giving records</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={generateCurrentWeek} v="gold">{currentWeekExists?"Regenerate This Week":"Generate This Week"}</Btn>
        </div>
      </div>

      <div style={{background:"#eff6ff",border:"0.5px solid "+BL+"44",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:BL,lineHeight:1.6}}>
        <strong>Auto-save active.</strong> Every week that has giving activity is automatically saved as a report. Click any report to view details, print, or regenerate with the latest numbers.
      </div>

      {sortedReports.length===0 ? (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
          <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>No reports yet</h3>
          <p style={{fontSize:13,color:MU,marginBottom:16}}>Reports will generate automatically as you record giving. Or click Generate This Week to create one now.</p>
          <Btn onClick={generateCurrentWeek} v="gold">+ Generate This Week</Btn>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {sortedReports.map(r=>{
            const catCount = Object.keys(r.byCategory).length;
            const isCurrentWeek = r.weekStart===todayMonday;
            return (
              <div key={r.id} onClick={()=>setViewReport(r)} style={{background:W,border:"0.5px solid "+(isCurrentWeek?G:BR),borderRadius:12,padding:15,cursor:"pointer",transition:"all 0.15s",position:"relative"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px #00000015"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                {isCurrentWeek && <span style={{position:"absolute",top:10,right:10,fontSize:9,background:G,color:"#fff",borderRadius:10,padding:"2px 7px",fontWeight:600,letterSpacing:0.5}}>CURRENT</span>}
                <div style={{fontSize:12,color:MU,marginBottom:3}}>Week of</div>
                <div style={{fontSize:15,fontWeight:500,color:N,marginBottom:10}}>{fd(r.weekStart)} — {fd(r.weekEnd)}</div>
                <div style={{fontSize:26,fontWeight:700,color:GR,marginBottom:4}}>{f$(r.total)}</div>
                <div style={{display:"flex",gap:10,fontSize:11,color:MU,marginBottom:10}}>
                  <span>{r.count} record{r.count!==1?"s":""}</span>
                  <span>·</span>
                  <span>{r.uniqueGivers} giver{r.uniqueGivers!==1?"s":""}</span>
                  <span>·</span>
                  <span>{catCount} categor{catCount!==1?"ies":"y"}</span>
                </div>
                {catCount>0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,paddingTop:10,borderTop:"0.5px solid "+BR}}>
                    {Object.entries(r.byCategory).slice(0,3).map(([cat,amt])=>(
                      <span key={cat} style={{fontSize:10,background:BG,color:TX,borderRadius:4,padding:"2px 7px",border:"0.5px solid "+BR}}>{cat}: {f$(amt)}</span>
                    ))}
                    {catCount>3 && <span style={{fontSize:10,color:MU}}>+{catCount-3} more</span>}
                  </div>
                )}
                <div style={{fontSize:10,color:MU,marginTop:8,fontStyle:"italic"}}>{r.auto?"Auto-generated":"Manually regenerated"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TithesView({giving,weeklyReports}){
  const [range,setRange] = useState("month");
  const today = new Date();

  // Filter giving by range
  let filteredGiving = giving;
  let rangeLabel = "All Time";
  if(range==="week"){
    const monday = getMondayOf(td());
    const sunday = getSundayOf(monday);
    filteredGiving = giving.filter(g=>g.date>=monday && g.date<=sunday);
    rangeLabel = "This Week ("+fd(monday)+" — "+fd(sunday)+")";
  } else if(range==="month"){
    const ym = today.toISOString().slice(0,7);
    filteredGiving = giving.filter(g=>g.date.startsWith(ym));
    rangeLabel = today.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  } else if(range==="ytd"){
    const yr = today.getFullYear()+"";
    filteredGiving = giving.filter(g=>g.date.startsWith(yr));
    rangeLabel = "Year to Date "+yr;
  }

  const tithes = calcTithes(filteredGiving);
  const totalInRange = filteredGiving.reduce((a,g)=>a+g.amount,0);

  // Weekly breakdown - compute tithes for each saved week
  const sortedWeeks = [...weeklyReports].sort((a,b)=>b.weekStart.localeCompare(a.weekStart));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Church Tithe & Pastor's Draw</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Church: 10% of offerings · Pastor's Draw: 60% of tithes + Sunday morning offering</div>
        </div>
        <div style={{display:"flex",gap:6,background:W,borderRadius:8,border:"0.5px solid "+BR,padding:3}}>
          {[["week","This Week"],["month","This Month"],["ytd","Year to Date"],["all","All Time"]].map(([id,label])=>(
            <button key={id} onClick={()=>setRange(id)} style={{padding:"6px 12px",border:"none",borderRadius:6,background:range===id?N:"transparent",color:range===id?"#fff":TX,fontSize:12,fontWeight:range===id?500:400,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{background:N+"08",border:"0.5px solid "+N+"22",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:N,fontWeight:500}}>
        Period: {rangeLabel} · Records in range: {filteredGiving.length} · Total giving: {f$(totalInRange)}
      </div>

      {/* Two big tithe cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={{background:W,border:"1.5px solid "+G,borderRadius:12,overflow:"hidden"}}>
          <div style={{background:N,color:"#fff",padding:"14px 18px"}}>
            <div style={{fontSize:11,color:G,textTransform:"uppercase",letterSpacing:1.5,fontWeight:600,marginBottom:2}}>Church Weekly Tithe</div>
            <div style={{fontSize:13}}>10% of offerings (excluding Tithe & Sun. Morning Offering)</div>
          </div>
          <div style={{padding:20}}>
            <div style={{fontSize:36,fontWeight:700,color:N,marginBottom:16}}>{f$(tithes.churchTithe)}</div>
            <div style={{fontSize:12,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,fontWeight:500}}>Calculation</div>
            <div style={{background:BG,borderRadius:8,padding:14,border:"0.5px solid "+BR}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
                <span style={{color:MU}}>Building Fund + Missions + Special Gift + other Offerings</span>
                <span style={{fontWeight:500}}>{f$(tithes.churchBase)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13,color:MU}}>
                <span>× 10%</span>
                <span></span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",fontSize:14,fontWeight:600,borderTop:"0.5px solid "+BR,marginTop:4}}>
                <span style={{color:N}}>Church Tithe Owed</span>
                <span style={{color:GR}}>{f$(tithes.churchTithe)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{background:W,border:"1.5px solid "+G,borderRadius:12,overflow:"hidden"}}>
          <div style={{background:G,color:"#fff",padding:"14px 18px"}}>
            <div style={{fontSize:11,color:"#fff",textTransform:"uppercase",letterSpacing:1.5,fontWeight:600,marginBottom:2,opacity:0.85}}>Pastor's Draw (Weekly)</div>
            <div style={{fontSize:13}}>60% of Tithes + Sunday Morning Offering</div>
          </div>
          <div style={{padding:20}}>
            <div style={{fontSize:36,fontWeight:700,color:N,marginBottom:16}}>{f$(tithes.pastorDraw??tithes.pastorTithe)}</div>
            <div style={{fontSize:12,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,fontWeight:500}}>Calculation</div>
            <div style={{background:BG,borderRadius:8,padding:14,border:"0.5px solid "+BR}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
                <span style={{color:MU}}>Tithe collected</span>
                <span style={{fontWeight:500}}>{f$(tithes.tithe)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
                <span style={{color:MU}}>Sunday Morning Offering</span>
                <span style={{fontWeight:500}}>{f$(tithes.sundayMorning)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13,color:N,borderTop:"0.5px solid "+BR,marginTop:4,paddingTop:8,fontWeight:500}}>
                <span>Subtotal</span>
                <span>{f$(tithes.pastorBase)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13,color:MU}}>
                <span>× 60%</span>
                <span></span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",fontSize:14,fontWeight:600,borderTop:"0.5px solid "+BR,marginTop:4}}>
                <span style={{color:N}}>Pastor's Draw</span>
                <span style={{color:GR}}>{f$(tithes.pastorDraw??tithes.pastorTithe)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Combined summary */}
      <div style={{background:GL+"44",border:"1px solid "+G,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:11,color:"#7a5c10",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Total Tithes for {rangeLabel}</div>
          <div style={{fontSize:12,color:"#7a5c10",marginTop:2}}>Church Tithe + Pastor's Draw combined</div>
        </div>
        <div style={{fontSize:30,fontWeight:700,color:N}}>{f$(tithes.churchTithe + (tithes.pastorDraw??tithes.pastorTithe))}</div>
      </div>

      {/* Weekly history */}
      {sortedWeeks.length>0 && (
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"0.5px solid "+BR,background:"#f8f9fc"}}>
            <h3 style={{fontSize:13,fontWeight:500,color:N,margin:0}}>Weekly Tithe History</h3>
            <div style={{fontSize:11,color:MU,marginTop:2}}>Tithes calculated for each saved weekly report</div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8f9fc"}}>{["Week","Total Giving","Church Tithe","Pastor's Draw","Combined"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
            <tbody>
              {sortedWeeks.map(r=>{
                const t = r.tithes || calcTithes([]);
                return (
                  <tr key={r.id} style={{borderBottom:"0.5px solid "+BR}}>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{fontSize:13,fontWeight:500}}>{fd(r.weekStart)}</div>
                      <div style={{fontSize:10,color:MU}}>to {fd(r.weekEnd)}</div>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:N}}>{f$(r.total)}</td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:N}}>{f$(t.churchTithe)}</td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:G}}>{f$(t.pastorDraw??t.pastorTithe)}</td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:600,color:GR}}>{f$(t.churchTithe + (t.pastorDraw??t.pastorTithe))}</td>
                  </tr>
                );
              })}
              <tr style={{background:GL+"22",fontWeight:600}}>
                <td style={{padding:"10px 14px",fontSize:13,color:N}}>Grand Total</td>
                <td style={{padding:"10px 14px",fontSize:13,color:N}}>{f$(sortedWeeks.reduce((a,r)=>a+r.total,0))}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:N}}>{f$(sortedWeeks.reduce((a,r)=>a+(r.tithes?.churchTithe||0),0))}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:G}}>{f$(sortedWeeks.reduce((a:number,r:any)=>a+(r.tithes?.pastorDraw??r.tithes?.pastorTithe??0),0))}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:GR}}>{f$(sortedWeeks.reduce((a:number,r:any)=>a+(r.tithes?.churchTithe||0)+(r.tithes?.pastorDraw??r.tithes?.pastorTithe??0),0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GivingHistory({giving,members,visitors}){
  const [search,setSearch]=useState("");
  const [filterType,setFilterType]=useState("all");
  const [selectedKey,setSelectedKey]=useState(null);
  const [timeFilter,setTimeFilter]=useState("all");
  const [customStart,setCustomStart]=useState("");
  const [customEnd,setCustomEnd]=useState("");

  const givers=(()=>{
    const map={};
    giving.forEach(g=>{
      const key=(g.name||"").trim().toLowerCase();
      if(!key) return;
      if(!map[key]){
        const member=members.find(m=>(m.first+" "+m.last).trim().toLowerCase()===key);
        const visitor=!member&&visitors.find(v=>(v.first+" "+v.last).trim().toLowerCase()===key);
        map[key]={key,name:g.name,type:member?"member":visitor?"visitor":"unlinked",person:member||visitor||null,gifts:[],totalGiven:0,giftCount:0};
      }
      map[key].gifts.push(g);
      map[key].totalGiven+=g.amount;
      map[key].giftCount++;
    });
    return Object.values(map).map(g=>({...g,lastGift:[...g.gifts].sort((a,b)=>b.date.localeCompare(a.date))[0],firstGift:[...g.gifts].sort((a,b)=>a.date.localeCompare(b.date))[0]}));
  })();

  const filtered=givers.filter(g=>{
    if(search&&!g.name.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterType!=="all"&&g.type!==filterType) return false;
    return true;
  }).sort((a,b)=>b.totalGiven-a.totalGiven);

  const selected=selectedKey?givers.find(g=>g.key===selectedKey):null;

  const today=new Date();
  let filteredGifts=selected?[...selected.gifts]:[];
  if(selected){
    if(timeFilter==="month"){const ym=today.toISOString().slice(0,7);filteredGifts=filteredGifts.filter(g=>g.date.startsWith(ym));}
    else if(timeFilter==="ytd"){const yr=today.getFullYear()+"";filteredGifts=filteredGifts.filter(g=>g.date.startsWith(yr));}
    else if(timeFilter==="custom"){
      if(customStart) filteredGifts=filteredGifts.filter(g=>g.date>=customStart);
      if(customEnd) filteredGifts=filteredGifts.filter(g=>g.date<=customEnd);
    }
    filteredGifts=filteredGifts.sort((a,b)=>b.date.localeCompare(a.date));
  }

  const stats=selected?{
    total:filteredGifts.reduce((a,g)=>a+g.amount,0),
    count:filteredGifts.length,
    avg:filteredGifts.length?Math.round(filteredGifts.reduce((a,g)=>a+g.amount,0)/filteredGifts.length):0,
    largest:filteredGifts.length?Math.max(...filteredGifts.map(g=>g.amount)):0,
    mostRecent:filteredGifts[0]||null,
    byCategory:(()=>{const cat={};filteredGifts.forEach(g=>{cat[g.category]=(cat[g.category]||0)+g.amount;});return cat;})()
  }:null;

  const badges={member:{bg:"#dcfce7",c:GR,label:"Member"},visitor:{bg:"#fff3e0",c:AM,label:"Visitor"},unlinked:{bg:"#f5f5f5",c:MU,label:"Unlinked"}};

  if(selected){
    const bs=badges[selected.type];
    const parts=selected.name.split(" ");
    const first=parts[0]||"";
    const last=parts.slice(1).join(" ")||"";
    const p=selected.person;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>{setSelectedKey(null);setTimeFilter("all");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:N,fontWeight:500,padding:0}}>{"< Back to All Givers"}</button>
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
          <Av f={first} l={last} sz={54}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:19,fontWeight:500,color:N}}>{selected.name}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
              <span style={{fontSize:11,background:bs.bg,color:bs.c,borderRadius:20,padding:"2px 10px",fontWeight:500}}>{bs.label}</span>
              {p&&p.phone&&<span style={{fontSize:11,color:MU}}>{p.phone}</span>}
              {p&&p.email&&<span style={{fontSize:11,color:MU}}>{p.email}</span>}
              {!p&&<span style={{fontSize:11,color:MU,fontStyle:"italic"}}>Not linked to directory</span>}
            </div>
          </div>
          {p&&p.email&&(
            <Btn onClick={()=>{
              const yearStr = timeFilter==="ytd" ? new Date().getFullYear()+"" : timeFilter==="month" ? new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"}) : timeFilter==="custom" ? ((customStart?fd(customStart):"")+" to "+(customEnd?fd(customEnd):"today")) : "All Time";
              const subject = yearStr+" Giving Statement — "+(window.__CS__?.name||"Church");
              const body = "Dear "+first+",\n\nThank you for your faithful giving to "+(window.__CS__?.name||"our church")+".\n\nGIVING SUMMARY — "+yearStr+"\nTotal Given: "+f$(stats.total)+"\nNumber of Gifts: "+stats.count+"\nAverage Gift: "+f$(stats.avg)+"\nLargest Gift: "+f$(stats.largest)+"\n\nBY CATEGORY:\n"+Object.entries(stats.byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>"  "+cat+": "+f$(amt)).join("\n")+"\n\n\"Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.\" — 2 Corinthians 9:7\n\nYour generosity has made a real difference in the work of the Lord. Please keep this statement for your records.\n\nWith deep gratitude,\n"+(window.__CS__?.pastorName||"Pastor")+"\n"+(window.__CS__?.name||"");
              window.__openEmailComposer__ && window.__openEmailComposer__({to:p.email,toName:selected.name,subject,body,category:"Year-End Statement",relatedType:"giving_summary",relatedId:selected.key});
            }} v="primary" style={{fontSize:12}}>Email Statement</Btn>
          )}
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:MU,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Time Range:</span>
          {[["month","This Month"],["ytd","Year to Date"],["all","All Time"],["custom","Custom"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTimeFilter(id)} style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid "+(timeFilter===id?G:BR),background:timeFilter===id?GL+"44":W,color:timeFilter===id?"#7a5c10":TX,fontSize:12,fontWeight:timeFilter===id?500:400,cursor:"pointer"}}>{label}</button>
          ))}
          {timeFilter==="custom"&&(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{padding:"6px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none"}}/>
              <span style={{fontSize:11,color:MU}}>to</span>
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{padding:"6px 8px",border:"0.5px solid "+BR,borderRadius:6,fontSize:12,outline:"none"}}/>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <Stat label="Total Given" value={f$(stats.total)} sub={stats.count+" gift"+(stats.count!==1?"s":"")} color={GR}/>
          <Stat label="Gift Count" value={stats.count} color={N}/>
          <Stat label="Average" value={f$(stats.avg)} color={G}/>
          <Stat label="Largest" value={f$(stats.largest)} color={BL}/>
          <Stat label="Most Recent" value={stats.mostRecent?fd(stats.mostRecent.date):"—"} sub={stats.mostRecent?f$(stats.mostRecent.amount):""} color={PU}/>
        </div>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 10px"}}>Giving Records ({filteredGifts.length})</h3>
        {filteredGifts.length===0?(
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU,fontSize:13}}>No gifts in this time range.</div>
        ):(
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#f8f9fc"}}>{["Date","Category","Amount","Method","Notes"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredGifts.map(g=>(
                  <tr key={g.id} style={{borderBottom:"0.5px solid "+BR}}>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500}}>{fd(g.date)}</td>
                    <td style={{padding:"10px 14px",fontSize:13}}>{g.category}</td>
                    <td style={{padding:"10px 14px",fontSize:14,fontWeight:500,color:GR}}>{f$(g.amount)}</td>
                    <td style={{padding:"10px 14px",fontSize:13}}>{g.method}</td>
                    <td style={{padding:"10px 14px",fontSize:13,color:MU}}>{g.notes||"—"}</td>
                  </tr>
                ))}
                <tr style={{background:GL+"22",fontWeight:600}}>
                  <td colSpan={2} style={{padding:"10px 14px",fontSize:13,color:N}}>Total</td>
                  <td style={{padding:"10px 14px",fontSize:14,color:GR}}>{f$(stats.total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(stats.byCategory).length>1&&(
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginTop:16}}>
            <h3 style={{fontSize:13,fontWeight:500,color:N,margin:"0 0 12px"}}>Breakdown by Category</h3>
            {Object.entries(stats.byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
              const pct=stats.total?Math.round(amt/stats.total*100):0;
              return (
                <div key={cat} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span>{cat}</span>
                    <span style={{fontWeight:500,color:GR}}>{f$(amt)} ({pct}%)</span>
                  </div>
                  <div style={{height:5,background:BG,borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:GR}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const memberCount=givers.filter(g=>g.type==="member").length;
  const visitorCount=givers.filter(g=>g.type==="visitor").length;
  const unlinkedCount=givers.filter(g=>g.type==="unlinked").length;

  return (
    <div>
      <div style={{background:GL+"33",border:"1px solid "+G,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#7a5c10"}}>
        <strong>Giving History</strong> — Search any giver by name to view their complete record. Giving is automatically matched to members and visitors.
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Stat label="Total Givers" value={givers.length}/>
        <Stat label="Members" value={memberCount} color={GR}/>
        <Stat label="Visitors" value={visitorCount} color={AM}/>
        <Stat label="Unlinked" value={unlinkedCount} color={MU} sub="Not in directory"/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name..." style={{flex:1,minWidth:220,padding:"9px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <div style={{display:"flex",gap:0,background:W,borderRadius:8,border:"0.5px solid "+BR,padding:3}}>
          {[["all","All"],["member","Members"],["visitor","Visitors"],["unlinked","Unlinked"]].map(([id,label])=>(
            <button key={id} onClick={()=>setFilterType(id)} style={{padding:"6px 14px",border:"none",borderRadius:6,background:filterType===id?N:"transparent",color:filterType===id?"#fff":TX,fontSize:12,fontWeight:filterType===id?500:400,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
      </div>
      {filtered.length===0?(
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:40,textAlign:"center",color:MU}}>{givers.length===0?"No giving records yet.":"No givers match your filters."}</div>
      ):(
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#f8f9fc"}}>
                {["Giver","Type","Total Given","Gifts","First Gift","Last Gift",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(g=>{
                const bs=badges[g.type];
                const parts=g.name.split(" ");
                const first=parts[0]||"";
                const last=parts.slice(1).join(" ")||"";
                return (
                  <tr key={g.key} onClick={()=>setSelectedKey(g.key)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f8f9fc"} onMouseLeave={e=>e.currentTarget.style.background=W}>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Av f={first} l={last}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:500,color:N}}>{g.name}</div>
                          {g.person&&(g.person.phone||g.person.email)&&<div style={{fontSize:11,color:MU}}>{g.person.phone||g.person.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px"}}><span style={{fontSize:11,background:bs.bg,color:bs.c,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{bs.label}</span></td>
                    <td style={{padding:"10px 14px",fontSize:14,fontWeight:500,color:GR}}>{f$(g.totalGiven)}</td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:N}}>{g.giftCount}</td>
                    <td style={{padding:"10px 14px",fontSize:12,color:MU}}>{fd(g.firstGift.date)}</td>
                    <td style={{padding:"10px 14px",fontSize:12,color:MU}}>{fd(g.lastGift.date)} · {f$(g.lastGift.amount)}</td>
                    <td style={{padding:"10px 14px"}}>
                      <Btn onClick={()=>setSelectedKey(g.key)} v="ai" style={{fontSize:11,padding:"4px 9px"}}>View</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Giving({giving,setGiving,pledgeDrives,setPledgeDrives,pledges,setPledges,members,visitors,weeklyReports,setWeeklyReports,emailTemplates}) {
  const [tab,setTab] = useState("giving");
  const [modal,setModal] = useState(false);
  const [form,setForm] = useState({date:td(),name:"",category:"Tithe",amount:"",method:"Cash",notes:""});
  const [rep,setRep] = useState("");
  const [load,setLoad] = useState(false);
  const nid = useRef(400);
  const sf = k => v => setForm(f=>({...f,[k]:v}));
  const thisMonth = giving.filter(g=>g.date.startsWith("2026-04"));
  const total = thisMonth.reduce((a,g)=>a+g.amount,0);
  const tithe = thisMonth.filter(g=>g.category==="Tithe").reduce((a,g)=>a+g.amount,0);
  const offering = thisMonth.filter(g=>g.category==="Offering").reduce((a,g)=>a+g.amount,0);
  const activeDrives = pledgeDrives.filter(d=>d.status==="Active").length;
  const save = () => {
    if(!form.name||!form.amount){alert("Name and amount required.");return;}
    setGiving([{...form,amount:+form.amount,id:nid.current++},...giving]);
    setModal(false);
    setForm({date:td(),name:"",category:"Tithe",amount:"",method:"Cash",notes:""});
  };
  const genAi = async () => {
    setLoad(true);
    const bp = {};
    giving.forEach(g=>{bp[g.name]=(bp[g.name]||0)+g.amount;});
    const top = Object.entries(bp).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,a])=>n+": $"+a).join(", ");
    const prompt = "Give Pastor Hall a 2-3 sentence giving report: April total $"+total+", Tithes $"+tithe+", Offerings $"+offering+". Top givers: "+top+". Add pastoral encouragement.";
    const txt = await callAI([{role:"user",content:prompt}],[],[],[],[],[],{});
    setRep(txt); setLoad(false);
  };
  return (
    <div>
      <div style={{display:"flex",marginBottom:20,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden"}}>
        {[["giving","Giving Records"],["history","Giving History"],["weekly","Weekly Reports"],["tithes","Tithes"],["pledges","Pledge Drives"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 8px",border:"none",borderBottom:"2px solid "+(tab===id?G:"transparent"),background:tab===id?"#f8f9fc":W,fontSize:13,fontWeight:tab===id?500:400,color:tab===id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            {label}
            {id==="weekly" && weeklyReports.length>0 && <span style={{background:BL,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:500}}>{weeklyReports.length}</span>}
            {id==="pledges" && activeDrives>0 && <span style={{background:G,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:500}}>{activeDrives}</span>}
          </button>
        ))}
      </div>
      {tab==="history" ? (
        <GivingHistory giving={giving} members={members} visitors={visitors}/>
      ) : tab==="tithes" ? (
        <TithesView giving={giving} weeklyReports={weeklyReports}/>
      ) : tab==="weekly" ? (
        <WeeklyReports giving={giving} weeklyReports={weeklyReports} setWeeklyReports={setWeeklyReports}/>
      ) : tab==="pledges" ? (
        <PledgeDrives pledgeDrives={pledgeDrives} setPledgeDrives={setPledgeDrives} pledges={pledges} setPledges={setPledges} giving={giving} members={members} visitors={visitors}/>
      ) : (
      <div>
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <Stat label="April Total" value={f$(total)} color={GR}/>
        <Stat label="Tithes" value={f$(tithe)} sub="This month"/>
        <Stat label="Offerings" value={f$(offering)} sub="This month" color={G}/>
        <Stat label="Records" value={giving.length} sub="All time"/>
      </div>
      {/* Pastor's Draw Card */}
      {(()=>{
        const todayMon = getMondayOf(td());
        const last5 = [...weeklyReports].sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).slice(0,5);
        const currentWeek = weeklyReports.find(r=>r.weekStart===todayMon);
        const cwTithes = currentWeek ? calcTithes(giving.filter((g:any)=>g.date>=todayMon&&g.date<=getSundayOf(todayMon))) : calcTithes([]);
        const draw = cwTithes.pastorDraw??cwTithes.pastorTithe;
        return(
          <div style={{background:W,border:"1.5px solid "+G,borderRadius:12,padding:18,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:11,color:"#7a5c10",textTransform:"uppercase",letterSpacing:1.5,fontWeight:600,marginBottom:2}}>Pastor's Draw — Current Week</div>
                <div style={{fontSize:11,color:MU}}>Week of {fd(todayMon)} · 60% of Tithes + Sunday Morning Offering</div>
              </div>
              <Btn onClick={()=>setTab("tithes")} v="gold" style={{fontSize:11,padding:"5px 12px"}}>Full Tithes View →</Btn>
            </div>
            <div style={{fontSize:38,fontWeight:700,color:N,marginBottom:4}}>{f$(draw)}</div>
            <div style={{fontSize:11,color:MU,marginBottom:14}}>Based on {f$(cwTithes.tithe)} tithes + {f$(cwTithes.sundayMorning)} Sunday morning offering = {f$(cwTithes.pastorBase)} × 60%</div>
            {last5.length>0&&<div style={{borderTop:"0.5px solid "+BR,paddingTop:12}}>
              <div style={{fontSize:11,color:MU,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Last {last5.length} Weeks</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {last5.map(r=>{
                  const t=r.tithes||calcTithes([]);
                  const d=t.pastorDraw??t.pastorTithe;
                  const isThis=r.weekStart===todayMon;
                  return(<div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:isThis?GL+"44":"transparent",borderRadius:6,border:isThis?"0.5px solid "+G:"none"}}>
                    <span style={{fontSize:12,color:isThis?"#7a5c10":MU,fontWeight:isThis?500:400}}>{fd(r.weekStart)} – {fd(r.weekEnd)}{isThis?" (current)":""}</span>
                    <span style={{fontSize:13,fontWeight:600,color:isThis?N:TX}}>{f$(d)}</span>
                  </div>);
                })}
              </div>
            </div>}
          </div>
        );
      })()}
      <div style={{background:GL+"33",border:"1px solid "+G,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontSize:13,fontWeight:600,color:"#7a5c10",marginBottom:2}}>Weekly Giving Report</div>
          <div style={{fontSize:11,color:"#7a5c10"}}>Generate a Monday–Sunday breakdown by category and payment method. All weeks auto-save and can be pulled up anytime.</div>
        </div>
        <Btn onClick={()=>setTab("weekly")} v="gold">View Weekly Reports{weeklyReports.length>0 && " ("+weeklyReports.length+")"}</Btn>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>AI Giving Report</h3>
          <Btn onClick={genAi} v="ai" style={{fontSize:12,padding:"5px 10px"}}>{load?"Generating...":"Generate Report"}</Btn>
        </div>
        <p style={{fontSize:13,lineHeight:1.7,color:rep?TX:MU,fontStyle:rep?"normal":"italic",margin:0}}>{rep||"Generate an AI-powered giving analysis and pastoral summary."}</p>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Giving Records</h3>
        <Btn onClick={()=>setModal(true)}>+ Record Giving</Btn>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f8f9fc"}}>
              {["Date","Name","Category","Amount","Method","Notes",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {giving.map(g=>{
              const person = members.find(m=>(m.first+" "+m.last)===g.name) || visitors.find(v=>(v.first+" "+v.last)===g.name);
              const personEmail = person?.email || "";
              return (
              <tr key={g.id} style={{borderBottom:"0.5px solid "+BR}}>
                <td style={{padding:"10px 14px",fontSize:13}}>{fd(g.date)}</td>
                <td style={{padding:"10px 14px",fontSize:13,fontWeight:500}}>{g.name}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{g.category}</td>
                <td style={{padding:"10px 14px",fontSize:14,fontWeight:500,color:GR}}>{f$(g.amount)}</td>
                <td style={{padding:"10px 14px",fontSize:13}}>{g.method}</td>
                <td style={{padding:"10px 14px",fontSize:13,color:MU}}>{g.notes||"None"}</td>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",gap:5}}>
                    {personEmail && <Btn onClick={()=>{
                      const receiptTpl = emailTemplates?.find(t=>t.id==="tpl_receipt");
                      const vars = {
                        first_name: g.name.split(" ")[0] || "Friend",
                        full_name: g.name,
                        church_name: window.__CS__?.name || "our church",
                        pastor_name: window.__CS__?.pastorName || "Pastor",
                        gift_date: fd(g.date),
                        gift_amount: f$(g.amount),
                        gift_category: g.category,
                        gift_method: g.method,
                        year: new Date().getFullYear()+"",
                        today: new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
                      };
                      const subject = receiptTpl ? renderTemplate(receiptTpl.subject,vars) : "Thank You for Your Gift";
                      const body = receiptTpl ? renderTemplate(receiptTpl.body,vars) : "Dear "+vars.first_name+",\n\nThank you for your gift of "+f$(g.amount)+" on "+fd(g.date)+" ("+g.category+").\n\n"+vars.pastor_name+"\n"+vars.church_name;
                      window.__openEmailComposer__ && window.__openEmailComposer__({to:personEmail,toName:g.name,subject,body,category:"Pledge Receipt",relatedType:"giving",relatedId:g.id});
                    }} v="ghost" style={{fontSize:11,padding:"3px 8px"}}>Receipt</Btn>}
                    <Btn onClick={()=>setGiving(giving.filter(r=>r.id!==g.id))} v="danger" style={{fontSize:11,padding:"3px 8px"}}>X</Btn>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Record Giving">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Date *"><Inp type="date" value={form.date} onChange={sf("date")}/></Fld>
          <Fld label="Category"><Slt value={form.category} onChange={sf("category")} opts={["Tithe","Sunday Morning Offering","Offering","Building Fund","Missions","Special Gift"]}/></Fld>
        </div>
        <Fld label="Givers Name *"><Inp value={form.name} onChange={sf("name")} placeholder="Full name"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Amount *"><Inp type="number" value={form.amount} onChange={sf("amount")} placeholder="0.00"/></Fld>
          <Fld label="Method"><Slt value={form.method} onChange={sf("method")} opts={["Cash","Check","Online","Zelle","Other"]}/></Fld>
        </div>
        <Fld label="Notes"><Inp value={form.notes} onChange={sf("notes")}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1,justifyContent:"center"}}>Save Record</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
      </div>
      )}
    </div>
  );
}

// ── PRAYER ──
function Prayer({prayers,setPrayers}) {
  const [modal,setModal] = useState(false);
  const [respModal,setRespModal] = useState(null);
  const [aiResp,setAiResp] = useState("");
  const [load,setLoad] = useState(false);
  const [form,setForm] = useState({name:"",request:"",date:td(),status:"Active"});
  const nid = useRef(500);
  const sf = k => v => setForm(f=>({...f,[k]:v}));
  const save = () => {
    if(!form.request){alert("Request required.");return;}
    setPrayers([{...form,id:nid.current++},...prayers]);
    setModal(false);
    setForm({name:"",request:"",date:td(),status:"Active"});
  };
  const genAi = async p => {
    setLoad(true);
    const prompt = "Write a warm 3-4 sentence pastoral prayer response to \""+p.request+"\" from "+(p.name||"a member")+". Include a scripture. Sign from Pastor Hall and NTCC.";
    const txt = await callAI([{role:"user",content:prompt}],[],[],[],[],[],{});
    setAiResp(txt); setLoad(false);
  };
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:20}}>
        <Stat label="Total" value={prayers.length}/>
        <Stat label="Active" value={prayers.filter(p=>p.status==="Active").length} color={AM}/>
        <Stat label="Answered" value={prayers.filter(p=>p.status==="Answered").length} color={GR}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Prayer Requests</h3>
        <Btn onClick={()=>setModal(true)}>+ Add Request</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {prayers.map(p=>(
          <div key={p.id} style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Av f={(p.name||"A").split(" ")[0]} l={(p.name||"A").split(" ")[1]||"A"} sz={32}/>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{p.name||"Anonymous"}</div>
                  <div style={{fontSize:11,color:MU}}>{fd(p.date)}</div>
                </div>
              </div>
              <span style={{fontSize:11,fontWeight:500,borderRadius:20,padding:"2px 9px",background:p.status==="Answered"?"#dcfce7":"#fef9c3",color:p.status==="Answered"?GR:"#854d0e"}}>{p.status}</span>
            </div>
            <p style={{fontSize:13,lineHeight:1.7,margin:"0 0 10px"}}>{p.request}</p>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{setRespModal(p);setAiResp("");}} v="ai" style={{fontSize:12,padding:"5px 10px"}}>AI Response</Btn>
              {p.status==="Active" && <Btn onClick={()=>setPrayers(prayers.map(r=>r.id===p.id?{...r,status:"Answered"}:r))} v="ghost" style={{fontSize:12,padding:"5px 10px"}}>Mark Answered</Btn>}
              <Btn onClick={()=>setPrayers(prayers.filter(r=>r.id!==p.id))} v="danger" style={{fontSize:12,padding:"5px 10px"}}>X</Btn>
            </div>
          </div>
        ))}
        {prayers.length===0 && <div style={{textAlign:"center",padding:40,color:MU}}>No prayer requests yet.</div>}
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Add Prayer Request">
        <Fld label="Name (optional)"><Inp value={form.name} onChange={sf("name")} placeholder="Anonymous"/></Fld>
        <Fld label="Prayer Request *">
          <textarea value={form.request} onChange={e=>sf("request")(e.target.value)} rows={4} placeholder="Enter prayer request..." style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
        </Fld>
        <Fld label="Date"><Inp type="date" value={form.date} onChange={sf("date")}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1,justifyContent:"center"}}>Save</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
      <Modal open={!!respModal} onClose={()=>{setRespModal(null);setAiResp("");}} title="AI Pastoral Response" width={520}>
        {respModal && (
          <div>
            <div style={{background:BG,borderRadius:8,padding:12,marginBottom:14,fontSize:13,lineHeight:1.7}}>
              <strong>Request:</strong> {respModal.request}
            </div>
            <Btn onClick={()=>genAi(respModal)} v="ai" style={{width:"100%",justifyContent:"center",marginBottom:12}}>{load?"Generating...":"Generate Response"}</Btn>
            <div style={{minHeight:100,fontSize:13,lineHeight:1.8,color:aiResp?TX:MU,fontStyle:aiResp?"normal":"italic",background:W,border:"0.5px solid "+BR,borderRadius:8,padding:14,whiteSpace:"pre-wrap"}}>{aiResp||"Your AI pastoral response will appear here."}</div>
            {aiResp && (
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                <Btn onClick={()=>navigator.clipboard.writeText(aiResp)} v="gold" style={{fontSize:12}}>Copy</Btn>
                <Btn onClick={()=>{
                  const person = respModal.name !== "Anonymous" && respModal.name ? respModal.name : null;
                  if(!person){alert("This prayer request is anonymous — no email address on file.");return;}
                  window.__openEmailComposer__ && window.__openEmailComposer__({to:"",toName:respModal.name,subject:"Praying With You",body:aiResp,category:"Prayer Response",relatedType:"prayer",relatedId:respModal.id});
                }} v="primary" style={{fontSize:12}}>Send as Email</Btn>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── AI ASSISTANT with ElevenLabs ──
function AIAssist({aiChat,setAiChat,members,setMembers,visitors,setVisitors,attendance,setAttendance,giving,setGiving,prayers,setView,isMobile}) {
  const [input,setInput] = useState("");
  const [load,setLoad] = useState(false);
  const [ttsOn,setTtsOn] = useState(false);
  const [elVoice,setElVoice] = useState(EL_VOICES[0].id);
  const [showSettings,setShowSettings] = useState(false);
  const [mem,setMem] = useState({preferences:"",commands:"",style:""});
  const [cmdCount,setCmdCount] = useState({});
  const [banner,setBanner] = useState(null);
  const [ttsError,setTtsError] = useState(null);
  const [aiApiKey,setAiApiKey] = useState(()=>localStorage.getItem("ntcc_ai_api_key")||"");
  const [apiKeySaved,setApiKeySaved] = useState(false);
  const [listening,setListening] = useState(false);
  const [showMem,setShowMem] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nid = useRef(600);
  // Initialize audio element once so autoplay unlock persists
  useEffect(()=>{ audioRef.current.volume=1; },[]);
  const mRef = useRef(members);
  const vRef = useRef(visitors);
  const aRef = useRef(attendance);
  const gRef = useRef(giving);
  useEffect(()=>{mRef.current=members;},[members]);
  useEffect(()=>{vRef.current=visitors;},[visitors]);
  useEffect(()=>{aRef.current=attendance;},[attendance]);
  useEffect(()=>{gRef.current=giving;},[giving]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[aiChat,load]);

  useEffect(()=>{
    try {
      const _r = localStorage.getItem("ntcc_ai_mem");
      if(_r) setMem(JSON.parse(_r));
      const _cc = localStorage.getItem("ntcc_ai_cmds");
      if(_cc) setCmdCount(JSON.parse(_cc));
      const _v = localStorage.getItem("ntcc_ai_voice");
      if(_v) setElVoice(_v);
    } catch(e) {}
  },[]);

  const saveMem = (m, c) => {
    try {
      localStorage.setItem("ntcc_ai_mem", JSON.stringify(m));
      localStorage.setItem("ntcc_ai_cmds", JSON.stringify(c));
    } catch(e) {}
  };

  const saveVoice = v => {
    try { localStorage.setItem("ntcc_ai_voice", v); } catch(e) {}
  };

  const speak = async text => {
    if (!ttsOn) return;
    const ok = await speakEL(text, elVoice);
    if (!ok) {
      setTtsError("ElevenLabs voice failed — verify API key & credits at elevenlabs.io, then try a different voice.");
      if (window.speechSynthesis) {
        const clean = text.replace(/\*\*|__|##|#|\[[\s\S]*?\]/g,"").replace(/\n+/g," ").substring(0,300);
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(clean));
      }
    } else {
      setTtsError(null);
    }
  };

  const updateMem = actionType => {
    const nc = {...cmdCount};
    if(actionType) { nc[actionType]=(nc[actionType]||0)+1; setCmdCount(nc); }
    const top = Object.entries(nc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k.replace(/_/g," ")+"("+v+"x)").join(", ");
    const nm = {
      preferences:"Prefers direct commands and decisive action. Faith-first perspective. Southern pastoral communication.",
      commands:top||mem.commands,
      style:"Pastor Hall communicates with authority and expects immediate execution on commands."
    };
    setMem(nm);
    saveMem(nm, nc);
  };

  const execAction = action => {
    if(!action) return;
    const {type,data,confirm:conf} = action;
    const id = nid.current++;
    if(type==="ADD_MEMBER") setMembers(m=>[...m,{id,first:data.first||"",last:data.last||"",status:data.status||"Active",role:data.role||"",phone:data.phone||"",email:data.email||"",joined:data.joined||td(),notes:"",family:""}]);
    else if(type==="ADD_VISITOR") setVisitors(v=>[...v,{id,first:data.first||"",last:data.last||"",stage:data.stage||"First Visit",phone:data.phone||"",email:data.email||"",firstVisit:data.firstVisit||td(),notes:data.notes||"",sponsor:""}]);
    else if(type==="LOG_ATTENDANCE") setAttendance(a=>[{id,date:data.date||td(),service:data.service||"Sunday Morning Worship",count:+data.count||0,members:+data.members||0,visitors:+data.visitors||0,notes:data.notes||""},...a]);
    else if(type==="RECORD_GIVING") setGiving(g=>[{id,date:data.date||td(),name:data.name||"",category:data.category||"Tithe",amount:+data.amount||0,method:data.method||"Cash",notes:data.notes||""},...g]);
    else if(type==="UPDATE_MEMBER") setMembers(m=>m.map(x=>x.id===+data.id?{...x,...data}:x));
    else if(type==="DELETE_MEMBER") { if(confirm("Delete this member?")) setMembers(m=>m.filter(x=>x.id!==+data.id)); }
    else if(type==="DELETE_VISITOR") { if(confirm("Delete this visitor?")) setVisitors(v=>v.filter(x=>x.id!==+data.id)); }
    else if(type==="NAVIGATE") setView(data.section);
    setBanner(conf||"Action completed.");
    setTimeout(()=>setBanner(null), 5000);
    updateMem(type);
  };

  const send = async override => {
    const msg = (override||input).trim();
    if(!msg||load) return;
    setInput("");
    const nc = [...aiChat,{role:"user",content:msg}];
    setAiChat(nc);
    setLoad(true);
    try {
      const raw = await callAI(nc, mRef.current, vRef.current, aRef.current, gRef.current, prayers, mem);
      const {clean,action} = parseAction(raw);
      setAiChat([...nc,{role:"assistant",content:clean}]);
      if(action) execAction(action); else updateMem(null);
      speak(clean);
    } catch(e) {
      const msg = (e as any)?.message||String(e);
      let friendly = "Error: " + msg + " — Please open Voice Settings and check your Anthropic API key.";
      if(msg.includes("No API key")) friendly = "No Anthropic API key found. Open Voice Settings and paste your key under \"Anthropic API Key\", then click Save Key.";
      else if(msg.includes("401")) friendly = "API key rejected (401). Please check your Anthropic key in Voice Settings — it may be invalid or revoked.";
      else if(msg.includes("429")) friendly = "Rate limit reached (429). Please wait a moment and try again, Sir.";
      else if(msg.includes("500")||msg.includes("529")) friendly = "Anthropic servers are temporarily unavailable. Please try again in a moment, Sir.";
      else if(msg.includes("Failed to fetch")||msg.includes("NetworkError")) friendly = "Network error — please check your internet connection, Sir.";
      console.error("AI error:", msg);
      setAiChat([...nc,{role:"assistant",content:friendly}]);
    }
    setLoad(false);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice input not available in this browser.");return;}
    const rec = new SR();
    rec.lang="en-US";
    rec.onresult = e => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start(); setListening(true);
  };

  const topCmds = Object.entries(cmdCount).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const QUICK = ["Give me a full church summary","Who needs follow-up?","Add a new member","Log today attendance","Record a tithe","Show inactive members","Generate a giving report","Draft a Sunday announcement"];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
      <style>{"@keyframes pulse{0%,100%{opacity:0.2}50%{opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}"}</style>
      <div style={{background:N,borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:GL,border:"2px solid "+G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>*</div>
          <div>
            <div style={{color:"#fff",fontWeight:500,fontSize:14}}>NTCC AI Assistant</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:1}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80"}}></div>
              <span style={{color:"#4ade80",fontSize:11}}>IQ 250 - ElevenLabs Voice - Learning Active</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div onClick={()=>{
            const willBeOn = !ttsOn;
            if (willBeOn) {
              _elAudio.src=SILENT_WAV; _elAudio.play().catch(()=>{});
            } else {
              _elAudio.pause();
            }
            setTtsOn(willBeOn);
          }} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 13px",borderRadius:20,border:"1.5px solid "+(ttsOn?"#4ade80":"#ffffff44"),cursor:"pointer",background:ttsOn?"#16a34a44":"transparent",color:ttsOn?"#4ade80":"#ffffff99",fontSize:12,fontWeight:ttsOn?600:400,transition:"all 0.2s"}}>
            {ttsOn?"🔊 Voice On":"🔇 Voice Off"}
          </div>
          <button onClick={()=>setShowMem(v=>!v)} style={{background:showMem?"#ffffff22":"#ffffff12",border:"0.5px solid #ffffff44",borderRadius:8,padding:"5px 11px",cursor:"pointer",color:"#fff",fontSize:12}}>Memory</button>
          <button onClick={()=>setShowSettings(true)} style={{background:"#ffffff12",border:"0.5px solid #ffffff44",borderRadius:8,padding:"5px 11px",cursor:"pointer",color:"#fff",fontSize:12}}>Voice Settings</button>
        </div>
      </div>
      {banner && (
        <div style={{background:GR,color:"#fff",padding:"9px 16px",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:8,borderRadius:8,marginBottom:10,flexShrink:0}}>
          Done: {banner}
          <button onClick={()=>setBanner(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>x</button>
        </div>
      )}
      {ttsError && (
        <div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",color:RE,padding:"9px 16px",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:8,borderRadius:8,marginBottom:10,flexShrink:0}}>
          Voice Error: {ttsError}
          <button onClick={()=>setTtsError(null)} style={{marginLeft:"auto",background:"none",border:"none",color:RE,cursor:"pointer",fontSize:16}}>x</button>
        </div>
      )}
      {!aiApiKey && (
        <div style={{background:"#fef3c7",border:"0.5px solid #fde68a",color:"#92400e",padding:"9px 16px",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:8,borderRadius:8,marginBottom:10,flexShrink:0}}>
          ⚠ No Anthropic API key — open <strong>Voice Settings</strong> to add your key and enable AI chat.
        </div>
      )}
      {showMem && (
        <div style={{background:"#f0fdf4",border:"0.5px solid #86efac",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,color:"#166534",flexShrink:0}}>
          <div style={{fontWeight:500,marginBottom:4}}>AI Memory - What I know about you, Pastor Hall</div>
          <div>{mem.preferences||"Still learning..."} | Commands: {mem.commands||"Building history..."}</div>
        </div>
      )}
      <div style={{display:"flex",flex:1,gap:14,overflow:"hidden"}}>
        {!isMobile && (
        <div style={{width:210,background:W,border:"0.5px solid "+BR,borderRadius:12,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto",padding:14}}>
          <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Quick Commands</div>
          {QUICK.map((cmd,i)=>(
            <button key={i} onClick={()=>{_elAudio.src=SILENT_WAV;_elAudio.play().catch(()=>{});send(cmd);}} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:"0.5px solid "+BR,background:BG,color:TX,fontSize:11,cursor:"pointer",textAlign:"left",marginBottom:5,lineHeight:1.4}}>{cmd}</button>
          ))}
          {topCmds.length>0 && (
            <div>
              <div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,marginTop:12,borderTop:"0.5px solid "+BR,paddingTop:12}}>Your Top Commands</div>
              {topCmds.map(([cmd,cnt])=>(
                <div key={cmd} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 6px",borderRadius:6,marginBottom:3}}>
                  <span style={{fontSize:11,color:TX}}>{cmd.replace(/_/g," ")}</span>
                  <span style={{fontSize:10,background:N+"22",color:N,borderRadius:10,padding:"1px 5px"}}>{cnt}x</span>
                </div>
              ))}
            </div>
          )}
          <div style={{borderTop:"0.5px solid "+BR,paddingTop:10,marginTop:10}}>
            {[["Members",members.length],["Visitors",visitors.length],["Services",attendance.length],["Giving Records",giving.length]].map(([label,val])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}>
                <span style={{fontSize:11,color:MU}}>{label}</span>
                <span style={{fontSize:11,fontWeight:500,color:N}}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        )}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{flex:1,overflowY:"auto",paddingRight:4,display:"flex",flexDirection:"column",gap:14}}>
            {aiChat.length===0 && (
              <div style={{textAlign:"center",paddingTop:24}}>
                <div style={{fontSize:44,marginBottom:12}}>*</div>
                <h2 style={{fontSize:18,fontWeight:500,color:N,marginBottom:8}}>Good day, Pastor Hall.</h2>
                <p style={{fontSize:13,color:MU,lineHeight:1.9,maxWidth:480,margin:"0 auto 20px"}}>
                  I am your NTCC AI, operating at IQ 250, with the strategic mind of Elon Musk, the inventive genius of Nikola Tesla, and a warm Southern pastoral heart. I am connected to your live database and ready to think and execute on your behalf, Sir.
                </p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                  {["Give me a full church summary","Who needs follow-up?","Add a new member","Record a tithe"].map((s,i)=>(
                    <button key={i} onClick={()=>send(s)} style={{padding:"7px 14px",borderRadius:20,border:"0.5px solid "+BR,background:W,fontSize:12,color:N,cursor:"pointer",fontWeight:500}}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {aiChat.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,alignItems:"flex-end"}}>
                {m.role==="assistant" && (
                  <div style={{width:34,height:34,borderRadius:"50%",background:GL,border:"1.5px solid "+G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>*</div>
                )}
                <div style={{maxWidth:"72%",padding:"11px 15px",borderRadius:14,fontSize:13,lineHeight:1.85,background:m.role==="user"?N:W,color:m.role==="user"?"#fff":TX,border:m.role==="user"?"none":"0.5px solid "+BR,borderBottomRightRadius:m.role==="user"?3:14,borderBottomLeftRadius:m.role==="assistant"?3:14,whiteSpace:"pre-wrap"}}>
                  {m.content}
                  {m.role==="assistant" && ttsOn && (
                    <button onClick={()=>speak(m.content)} style={{display:"block",marginTop:6,background:"none",border:"none",cursor:"pointer",fontSize:11,color:MU,padding:0}}>Replay voice</button>
                  )}
                </div>
                {m.role==="user" && (
                  <div style={{width:34,height:34,borderRadius:"50%",background:N,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:G,flexShrink:0,border:"2px solid "+G+"44"}}>PH</div>
                )}
              </div>
            ))}
            {load && (
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:GL,border:"1.5px solid "+G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>*</div>
                <div style={{padding:"11px 15px",background:W,border:"0.5px solid "+BR,borderRadius:14,borderBottomLeftRadius:3}}>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {[0,0.15,0.3].map((d,i)=>(
                      <div key={i} style={{width:8,height:8,borderRadius:"50%",background:N,animation:"pulse 1.2s "+d+"s infinite"}}/>
                    ))}
                    <span style={{fontSize:12,color:MU,marginLeft:6}}>Thinking, Pastor Hall...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>
          <div style={{marginTop:12,background:W,borderRadius:12,padding:"10px 14px",border:"1.5px solid "+BR,display:"flex",gap:10,alignItems:"flex-end"}}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Talk to me, Pastor Hall — give a command or ask anything..." rows={2} style={{flex:1,resize:"none",border:"none",outline:"none",fontSize:13,fontFamily:"inherit",lineHeight:1.6,background:"transparent"}}/>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
              <button onClick={startListening} style={{width:38,height:38,borderRadius:"50%",border:"none",background:listening?"#fee2e2":N+"18",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:listening?RE:N}}>
                {listening?"Stop":"Mic"}
              </button>
              <Btn onClick={()=>{_elAudio.src=SILENT_WAV;_elAudio.play().catch(()=>{});send();}} disabled={load||!input.trim()} style={{padding:"9px 18px"}}>{load?"...":"Send"}</Btn>
            </div>
          </div>
          <div style={{fontSize:11,color:MU,marginTop:6,textAlign:"center"}}>Enter to send - Shift+Enter for new line - Mic for voice input - commands execute live</div>
        </div>
      </div>

      <Modal open={showSettings} onClose={()=>setShowSettings(false)} title="ElevenLabs Voice Settings" width={520}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Voice Output</div>
          <div onClick={()=>{
            const willBeOn = !ttsOn;
            if(willBeOn){_elAudio.src=SILENT_WAV;_elAudio.play().catch(()=>{});}
            else _elAudio.pause();
            setTtsOn(willBeOn);
          }} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:10,border:"0.5px solid "+BR,cursor:"pointer",background:ttsOn?"#f0fdf4":BG,marginBottom:12}}>
            <div style={{width:44,height:24,borderRadius:12,background:ttsOn?GR:BR,position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:ttsOn?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}></div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:ttsOn?GR:TX}}>{ttsOn?"ElevenLabs Voice Enabled":"Voice Disabled"}</div>
              <div style={{fontSize:11,color:MU}}>AI will speak every response using ElevenLabs realistic voice</div>
            </div>
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,color:MU,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Select Voice</div>
          {EL_VOICES.map(v=>(
            <div key={v.id} onClick={()=>{setElVoice(v.id);saveVoice(v.id);}} style={{padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(elVoice===v.id?N:BR),background:elVoice===v.id?N+"08":W,cursor:"pointer",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:elVoice===v.id?500:400,color:elVoice===v.id?N:TX}}>{v.name}</div>
                <div style={{fontSize:11,color:MU}}>{v.desc}</div>
              </div>
              <button onClick={async e=>{
                e.stopPropagation();
                _elAudio.src=SILENT_WAV; _elAudio.play().catch(()=>{});
                await speakEL("Good day Pastor Hall, I am your NTCC AI Assistant, ready to serve the ministry.", v.id);
              }} style={{padding:"6px 12px",background:N,color:"#fff",border:"none",borderRadius:6,fontSize:11,cursor:"pointer",flexShrink:0}}>Preview</button>
            </div>
          ))}
        </div>
        <div style={{background:"#f0f9ff",border:"0.5px solid #7dd3fc",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:500,color:BL,marginBottom:4}}>Anthropic API Key (AI Brain)</div>
          <div style={{fontSize:11,color:MU,marginBottom:10}}>Required for AI chat. Get yours free at console.anthropic.com → API Keys.</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="password" value={aiApiKey} onChange={e=>setAiApiKey(e.target.value)} placeholder="sk-ant-api03-..." style={{flex:1,padding:"8px 10px",border:"1.5px solid "+(aiApiKey?"#7dd3fc":RE),borderRadius:7,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
            <button onClick={()=>{localStorage.setItem("ntcc_ai_api_key",aiApiKey);setApiKeySaved(true);setTimeout(()=>setApiKeySaved(false),2500);}} style={{padding:"8px 14px",background:apiKeySaved?GR:BL,color:"#fff",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"}}>{apiKeySaved?"✓ Saved!":"Save Key"}</button>
          </div>
          {!aiApiKey&&<div style={{fontSize:11,color:RE,marginTop:6}}>⚠ No key saved — AI chat will not work until a key is entered.</div>}
          {aiApiKey&&<div style={{fontSize:11,color:GR,marginTop:6}}>✓ API key saved.</div>}
        </div>
        <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:13,fontWeight:500,color:RE,marginBottom:4}}>Clear AI Memory</div>
          <div style={{fontSize:11,color:MU,marginBottom:10}}>Erase everything the AI has learned about you, Pastor Hall.</div>
          <button onClick={async()=>{
            if(!confirm("Clear all AI memory?")) return;
            setMem({preferences:"",commands:"",style:""});
            setCmdCount({});
            try { localStorage.removeItem("ntcc_ai_mem"); localStorage.removeItem("ntcc_ai_cmds"); } catch(e) {}
            setShowSettings(false);
          }} style={{padding:"7px 14px",background:"#fee2e2",color:RE,border:"0.5px solid #fca5a5",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:500}}>Clear All Memory</button>
        </div>
      </Modal>
    </div>
  );
}

// ── EDUCATION DEPARTMENT ──
function EdDashboard({classrooms,children,kidsCheckIns,teacherSchedule,users,members,checkIns,setTab}){
  const today=td();
  const todayCI=kidsCheckIns.filter(c=>c.date===today);
  const activeCI=todayCI.filter(c=>!c.checkedOut);
  const todaySch=teacherSchedule.filter(t=>t.date===today);
  const chapel=checkIns.filter(c=>c.date===today).length;
  return(
    <div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <Stat label="Kids Checked In" value={activeCI.length} color={GR} sub={todayCI.filter(c=>c.checkedOut).length+" checked out"}/>
        <Stat label="Classrooms Staffed" value={todaySch.filter(t=>t.leadId).length+"/"+classrooms.length} color={N}/>
        <Stat label="Active Children" value={children.filter(c=>c.status==="Active").length} color={BL}/>
        <Stat label="Total Sunday Count" value={activeCI.length+chapel} color={G} sub={chapel+" chapel + "+activeCI.length+" kids"}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Today's Check-Ins</h3>
            {activeCI.length>0&&<Btn onClick={()=>setTab("checkin")} v="ai" style={{fontSize:11,padding:"4px 9px"}}>Portal</Btn>}
          </div>
          {activeCI.length===0?(<div style={{textAlign:"center",padding:24}}><div style={{fontSize:13,color:MU,marginBottom:12}}>No kids checked in yet today.</div><Btn onClick={()=>setTab("checkin")} v="primary">Open Check-In Portal</Btn></div>):(<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto"}}>{activeCI.slice(0,8).map(ci=>{const ch=children.find(c=>c.id===ci.childId);const cl=classrooms.find(c=>c.id===ci.classroomId);if(!ch||!cl)return null;return (<div key={ci.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 11px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}><Av f={ch.first} l={ch.last} sz={28}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500}}>{ch.first} {ch.last}</div><div style={{fontSize:11,color:cl.color,fontWeight:500}}>{cl.name} - {ci.time}</div></div><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:N}}>{ci.code}</div>{(ch.allergies?.length>0||ch.medical?.length>0)&&<span style={{fontSize:10,background:"#fee2e2",color:RE,borderRadius:4,padding:"2px 5px",fontWeight:500}}>!</span>}</div>);})}</div>)}
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:500,color:N,margin:0}}>Today's Teaching Team</h3>
            <Btn onClick={()=>setTab("teachers")} v="ghost" style={{fontSize:11,padding:"4px 9px"}}>Schedule</Btn>
          </div>
          {todaySch.length===0?(<div style={{textAlign:"center",padding:24,color:MU,fontSize:13}}><div style={{marginBottom:8}}>No teacher assignments today.</div><Btn onClick={()=>setTab("teachers")} v="outline" style={{fontSize:12}}>Set up schedule</Btn></div>):(<div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:320,overflowY:"auto"}}>{classrooms.map(cl=>{const s=todaySch.find(t=>t.classroomId===cl.id);const lu=s?.leadId&&users.find(u=>u.id===s.leadId);const lm=lu&&members.find(m=>m.id===lu.memberId);return (<div key={cl.id} style={{padding:"7px 10px",background:BG,borderRadius:7,border:"0.5px solid "+BR,display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",background:cl.color,flexShrink:0}}></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:cl.color}}>{cl.name}</div><div style={{fontSize:11,color:lm?TX:MU,fontStyle:lm?"normal":"italic"}}>{lm?lm.first+" "+lm.last:"No teacher assigned"}{s?.helperIds?.length>0&&" +"+s.helperIds.length}</div></div></div>);})}</div>)}
        </div>
      </div>
    </div>
  );
}

function PrintLabels({ci,child,classroom,onClose}){
  const meds=[...(child.allergies||[]),...(child.medical||[])];
  return(<><style>{"@media print{body *{visibility:hidden;}.ntcc-label-print,.ntcc-label-print *{visibility:visible;}.ntcc-label-print{position:absolute;left:0;top:0;width:100%;padding:10mm;}.ntcc-no-print{display:none !important;}}"}</style><div style={{position:"fixed",inset:0,background:"#00000077",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} className="ntcc-no-print"><div style={{background:W,borderRadius:12,width:480,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto"}}><div style={{padding:"16px 20px",borderBottom:"0.5px solid "+BR,display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:16,fontWeight:500,color:N,margin:0}}>Labels Ready</h2><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:MU}}>x</button></div><div style={{padding:20}}><div className="ntcc-label-print" style={{display:"flex",flexDirection:"column",gap:14}}><div style={{border:"2px solid "+N,borderRadius:10,padding:14,fontFamily:"system-ui,sans-serif"}}><div style={{background:classroom.color,color:"#fff",padding:"6px 12px",borderRadius:6,marginBottom:10,fontWeight:700,fontSize:13,textAlign:"center",letterSpacing:1}}>{classroom.name.toUpperCase()}</div><div style={{fontSize:26,fontWeight:800,textAlign:"center",marginBottom:4,color:"#000"}}>{child.first} {child.last}</div><div style={{fontSize:12,color:"#444",textAlign:"center",marginBottom:10}}>DOB: {fd(child.dob)} - Age {calcAge(child.dob)}</div>{meds.length>0&&<div style={{background:"#fee2e2",border:"2px solid "+RE,color:RE,padding:"7px 10px",borderRadius:6,textAlign:"center",fontSize:11,fontWeight:700,marginBottom:10}}>MEDICAL: {meds.join(", ")}</div>}<div style={{background:BG,borderRadius:6,padding:"10px 12px",textAlign:"center",border:"1px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:2}}>Pickup Code</div><div style={{fontSize:36,fontWeight:800,fontFamily:"monospace",letterSpacing:6,color:"#000",lineHeight:1.1}}>{ci.code}</div></div><div style={{fontSize:10,color:MU,textAlign:"center",marginTop:8}}>{fd(ci.date)} - {ci.time}</div></div><div style={{border:"2px dashed "+N,borderRadius:10,padding:14,fontFamily:"system-ui,sans-serif"}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:1,textAlign:"center",marginBottom:8,fontWeight:600}}>Parent Pickup Stub</div><div style={{fontSize:20,fontWeight:700,textAlign:"center",color:"#000",marginBottom:2}}>{child.first} {child.last}</div><div style={{fontSize:12,color:"#444",textAlign:"center",marginBottom:10}}>Classroom: {classroom.name}</div><div style={{background:BG,borderRadius:6,padding:"10px 12px",textAlign:"center",marginBottom:8,border:"1px solid "+BR}}><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:2}}>Your Code</div><div style={{fontSize:36,fontWeight:800,fontFamily:"monospace",letterSpacing:6,color:"#000",lineHeight:1.1}}>{ci.code}</div></div><div style={{fontSize:11,color:"#444",textAlign:"center"}}>Parent: {child.parentName||"-"} - {child.parentPhone||"-"}</div><div style={{fontSize:9,color:MU,textAlign:"center",marginTop:6,fontStyle:"italic"}}>Present at pickup. Code must match.</div></div></div></div><div style={{padding:"14px 20px",borderTop:"0.5px solid "+BR,display:"flex",gap:10}} className="ntcc-no-print"><Btn onClick={()=>window.print()} v="primary" style={{flex:1,justifyContent:"center",padding:"10px",fontSize:14}}>Print Both Labels</Btn><Btn onClick={onClose} v="ghost" style={{flex:1,justifyContent:"center"}}>Close</Btn></div></div></div></>);
}

function CheckInPortal({classrooms,children,setChildren,kidsCheckIns,setKidsCheckIns,members}){
  const today=td();
  const [selDate,setSelDate]=useState(today);
  const [search,setSearch]=useState("");
  const [newModal,setNewModal]=useState(false);
  const [newChild,setNewChild]=useState({first:"",last:"",dob:"",grade:"",parentName:"",parentPhone:"",allergies:[],medical:[],medicalNotes:"",emergencyPickup:""});
  const [printData,setPrintData]=useState(null);
  const [selChild,setSelChild]=useState(null);
  const [selClass,setSelClass]=useState(null);
  const nid=useRef(900);
  const dateCI=kidsCheckIns.filter(c=>c.date===selDate);
  const activeCI=dateCI.filter(c=>!c.checkedOut);
  const results=search.length>1?children.filter(c=>(c.first+" "+c.last).toLowerCase().includes(search.toLowerCase())&&c.status==="Active"):[];
  const pickChild=c=>{const age=calcAge(c.dob);const minorRooms=classrooms.filter(cl=>cl.checkin!==false&&cl.id<=6);setSelChild(c);setSelClass(minorRooms.find(cl=>typeof age==="number"&&age>=cl.ageMin&&age<=cl.ageMax)||minorRooms.find(cl=>cl.grade===c.grade)||minorRooms[3]||null);setSearch("");};
  const doCheckIn=()=>{if(!selChild||!selClass)return;const code=genCode();const ci={id:nid.current++,childId:selChild.id,classroomId:selClass.id,date:selDate,time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}),code,checkedOut:false};setKidsCheckIns(cs=>[...cs,ci]);setPrintData({ci,child:selChild,classroom:selClass});setSelChild(null);setSelClass(null);};
  const doCheckOut=id=>{if(!confirm("Verify parent code matches child tag, then check out?"))return;setKidsCheckIns(cs=>cs.map(c=>c.id===id?{...c,checkedOut:true,checkOutAt:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true})}:c));};
  const addChild=()=>{if(!newChild.first||!newChild.last||!newChild.grade){alert("Name and level required.");return;}const id=600+children.length+1;const c={...newChild,id,status:"Active"};setChildren(cs=>[...cs,c]);pickChild(c);setNewModal(false);setNewChild({first:"",last:"",dob:"",grade:"",parentName:"",parentPhone:"",allergies:[],medical:[],medicalNotes:"",emergencyPickup:""});};
  const reprint=id=>{const ci=kidsCheckIns.find(c=>c.id===id);if(!ci)return;const ch=children.find(c=>c.id===ci.childId);const cl=classrooms.find(c=>c.id===ci.classroomId);if(ch&&cl)setPrintData({ci,child:ch,classroom:cl});};
  return(
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:13,fontWeight:500,color:MU}}>Check-In Date:</div>
        <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <div style={{flex:1}}></div>
        <div style={{fontSize:12,color:MU}}>{activeCI.length} in - {dateCI.filter(c=>c.checkedOut).length} out</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Check In a Child</h3>
          {!selChild?(<div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type child's name..." style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:8}}/>{search.length<=1&&<div style={{textAlign:"center",padding:16,color:MU,fontSize:12}}>Start typing to find a child</div>}{results.length>0&&(<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:280,overflowY:"auto"}}>{results.map(ch=>{const inn=activeCI.some(c=>c.childId===ch.id);return (<div key={ch.id} onClick={()=>!inn&&pickChild(ch)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,border:"0.5px solid "+(inn?GR+"55":BR),background:inn?"#f0fdf4":W,cursor:inn?"default":"pointer"}}><Av f={ch.first} l={ch.last} sz={32}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{ch.first} {ch.last}</div><div style={{fontSize:11,color:MU}}>Age {calcAge(ch.dob)} · {ch.grade} · {ch.parentName}</div></div>{inn&&<span style={{fontSize:10,background:GR,color:"#fff",borderRadius:10,padding:"2px 7px",fontWeight:500}}>In</span>}</div>);})}</div>)}{search.length>1&&results.length===0&&<div style={{textAlign:"center",padding:16,color:MU,fontSize:12}}>No child found. Add them as new.</div>}<Btn onClick={()=>{setNewModal(true);const p=search.trim().split(" ");setNewChild(n=>({...n,first:p[0]||"",last:p.slice(1).join(" ")||""}));}} v="outline" style={{width:"100%",justifyContent:"center"}}>+ Add New Child</Btn></div>):(<div><div style={{padding:14,background:BG,borderRadius:10,border:"0.5px solid "+BR,marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><Av f={selChild.first} l={selChild.last} sz={48}/><div style={{flex:1}}><div style={{fontSize:16,fontWeight:500}}>{selChild.first} {selChild.last}</div><div style={{fontSize:12,color:MU}}>Age {calcAge(selChild.dob)} · {selChild.grade}</div><div style={{fontSize:12,color:MU}}>Parent: {selChild.parentName} - {selChild.parentPhone}</div></div><button onClick={()=>{setSelChild(null);setSelClass(null);}} style={{background:"none",border:"none",cursor:"pointer",color:MU,fontSize:16}}>x</button></div>{(selChild.allergies?.length>0||selChild.medical?.length>0)&&<div style={{padding:"7px 10px",background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:6,fontSize:11}}><strong style={{color:RE}}>MEDICAL:</strong>{selChild.allergies?.length>0&&" Allergies: "+selChild.allergies.join(", ")+"."}{selChild.medical?.length>0&&" Conditions: "+selChild.medical.join(", ")+"."}{selChild.medicalNotes&&" "+selChild.medicalNotes}</div>}</div><div style={{fontSize:11,color:MU,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Classroom</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6,marginBottom:12}}>{classrooms.filter(cl=>cl.checkin!==false&&cl.id<=6).map(cl=>{const sel=selClass?.id===cl.id;const age=calcAge(selChild.dob);const rec=typeof age==="number"&&age>=cl.ageMin&&age<=cl.ageMax;const count=activeCI.filter(c=>c.classroomId===cl.id).length;const full=count>=cl.capacity;return (<button key={cl.id} onClick={()=>!full&&setSelClass(cl)} disabled={full} style={{padding:"8px 6px",borderRadius:7,border:"1.5px solid "+(sel?cl.color:rec?G:BR),background:sel?cl.color+"14":rec?GL+"44":W,cursor:full?"not-allowed":"pointer",opacity:full?0.4:1,fontSize:11,fontWeight:sel?600:400,color:sel?cl.color:TX,textAlign:"center"}}><div>{cl.name}</div><div style={{fontSize:9,color:MU,marginTop:2}}>{count}/{cl.capacity}</div></button>);})}</div><Btn onClick={doCheckIn} v="success" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}} disabled={!selClass}>Check In and Print Labels</Btn></div>)}
        </div>
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
          <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>{fd(selDate)} - {activeCI.length} Active</h3>
          {activeCI.length===0?(<div style={{textAlign:"center",padding:32,color:MU,fontSize:13}}>No active check-ins yet.</div>):(<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:500,overflowY:"auto"}}>{activeCI.map(ci=>{const ch=children.find(c=>c.id===ci.childId);const cl=classrooms.find(c=>c.id===ci.classroomId);if(!ch||!cl)return null;return (<div key={ci.id} style={{padding:"10px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><Av f={ch.first} l={ch.last} sz={32}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{ch.first} {ch.last}</div><div style={{fontSize:11,color:cl.color,fontWeight:500}}>{cl.name}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:700,color:N,fontFamily:"monospace",letterSpacing:1}}>{ci.code}</div><div style={{fontSize:10,color:MU}}>{ci.time}</div></div></div><div style={{display:"flex",gap:6}}><Btn onClick={()=>reprint(ci.id)} v="ghost" style={{flex:1,fontSize:11,padding:"4px 8px",justifyContent:"center"}}>Reprint</Btn><Btn onClick={()=>doCheckOut(ci.id)} v="danger" style={{flex:1,fontSize:11,padding:"4px 8px",justifyContent:"center"}}>Check Out</Btn></div></div>);})}</div>)}
          {dateCI.filter(c=>c.checkedOut).length>0&&<div style={{marginTop:12,paddingTop:12,borderTop:"0.5px solid "+BR}}><div style={{fontSize:11,color:MU,marginBottom:6}}>Checked Out ({dateCI.filter(c=>c.checkedOut).length})</div>{dateCI.filter(c=>c.checkedOut).slice(-5).map(ci=>{const ch=children.find(c=>c.id===ci.childId);return ch?(<div key={ci.id} style={{fontSize:11,color:MU,padding:"2px 0"}}>{ch.first} {ch.last} - {ci.checkOutAt}</div>):null;})}</div>}
        </div>
      </div>
      <Modal open={newModal} onClose={()=>setNewModal(false)} title="Register New Child" width={500}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="First Name *"><Inp value={newChild.first} onChange={v=>setNewChild(c=>({...c,first:v}))}/></Fld>
          <Fld label="Last Name *"><Inp value={newChild.last} onChange={v=>setNewChild(c=>({...c,last:v}))}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Date of Birth"><Inp type="date" value={newChild.dob} onChange={v=>setNewChild(c=>({...c,dob:v}))}/></Fld>
          <Fld label="Level *"><select value={newChild.grade} onChange={e=>setNewChild(c=>({...c,grade:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}><option value="">Select level</option>{CHURCH_LEVELS.slice(0,6).map(l=><option key={l.name} value={l.name}>{l.label}</option>)}</select></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Parent Name"><Inp value={newChild.parentName} onChange={v=>setNewChild(c=>({...c,parentName:v}))}/></Fld>
          <Fld label="Parent Phone"><Inp value={newChild.parentPhone} onChange={v=>setNewChild(c=>({...c,parentPhone:v}))}/></Fld>
        </div>
        <Fld label="Emergency Pickup"><Inp value={newChild.emergencyPickup} onChange={v=>setNewChild(c=>({...c,emergencyPickup:v}))} placeholder="Grandma Jean, Uncle Mike..."/></Fld>
        <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{fontSize:11,color:RE,fontWeight:600,marginBottom:6}}>MEDICAL and ALLERGIES</div>
          <div style={{fontSize:11,color:MU,marginBottom:4}}>Allergies:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{CALLERGIES.map(a=>{const on=newChild.allergies.includes(a);return (<div key={a} onClick={()=>setNewChild(c=>({...c,allergies:on?c.allergies.filter(x=>x!==a):[...c.allergies,a]}))} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:on?"#fee2e2":W,color:on?RE:MU,border:"0.5px solid "+(on?"#fca5a5":BR),fontWeight:on?500:400}}>{a}</div>);})}</div>
          <div style={{fontSize:11,color:MU,marginBottom:4}}>Conditions:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{CMEDICAL.map(m=>{const on=newChild.medical.includes(m);return (<div key={m} onClick={()=>setNewChild(c=>({...c,medical:on?c.medical.filter(x=>x!==m):[...c.medical,m]}))} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:on?"#eff6ff":W,color:on?BL:MU,border:"0.5px solid "+(on?BL+"55":BR),fontWeight:on?500:400}}>{m}</div>);})}</div>
          <Fld label="Medical Notes"><Inp value={newChild.medicalNotes} onChange={v=>setNewChild(c=>({...c,medicalNotes:v}))} placeholder="EpiPen location..."/></Fld>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={addChild} v="success" style={{flex:1,justifyContent:"center"}}>Register and Continue</Btn>
          <Btn onClick={()=>setNewModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
      {printData&&<PrintLabels ci={printData.ci} child={printData.child} classroom={printData.classroom} onClose={()=>setPrintData(null)}/>}
    </div>
  );
}

function ChildrenRoster({children,setChildren,classrooms,members,kidsCheckIns,incidents}){
  const [search,setSearch]=useState("");
  const [filterGrade,setFilterGrade]=useState("all");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({first:"",last:"",dob:"",grade:"",parentName:"",parentPhone:"",parentMemberId:null,allergies:[],medical:[],medicalNotes:"",emergencyPickup:"",status:"Active"});
  const nid=useRef(700);
  const filtered=children.filter(c=>{if(search&&!(c.first+" "+c.last).toLowerCase().includes(search.toLowerCase()))return false;if(filterGrade!=="all"&&c.grade!==filterGrade)return false;return true;});
  const openEdit=ch=>{setEditing(ch);setForm({...ch,allergies:ch.allergies||[],medical:ch.medical||[]});setModal(true);};
  const openAdd=()=>{setEditing(null);setForm({first:"",last:"",dob:"",grade:"",parentName:"",parentPhone:"",parentMemberId:null,allergies:[],medical:[],medicalNotes:"",emergencyPickup:"",status:"Active"});setModal(true);};
  const save=()=>{if(!form.first||!form.last||!form.grade){alert("Name and level required.");return;}if(editing)setChildren(cs=>cs.map(c=>c.id===editing.id?{...c,...form}:c));else setChildren(cs=>[...cs,{...form,id:nid.current++}]);setModal(false);};
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search children..." style={{flex:1,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} style={{padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W}}>
          <option value="all">All levels</option>
          {CHURCH_LEVELS.map(l=><option key={l.name} value={l.name}>{l.name}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add Child</Btn>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8f9fc"}}>{["Child","Age","Level","Parent","Medical","Last Visit",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(ch=>{const last=[...kidsCheckIns].filter(ci=>ci.childId===ch.id).sort((a,b)=>b.date.localeCompare(a.date))[0];const hasMed=(ch.allergies?.length>0||ch.medical?.length>0);const hasOpenInc=(incidents||[]).some(i=>i.childId===ch.id&&i.status!=="Resolved");return (<tr key={ch.id} onClick={()=>openEdit(ch)} style={{borderBottom:"0.5px solid "+BR,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f8f9fc"} onMouseLeave={e=>e.currentTarget.style.background=W}><td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Av f={ch.first} l={ch.last} sz={30}/><div><div style={{fontSize:13,fontWeight:500}}>{ch.first} {ch.last}</div>{hasOpenInc&&<span style={{fontSize:10,background:"#fee2e2",color:RE,borderRadius:10,padding:"1px 6px",fontWeight:600}}>Incident</span>}</div></div></td><td style={{padding:"10px 14px",fontSize:13}}>{calcAge(ch.dob)}</td><td style={{padding:"10px 14px",fontSize:13}}>{ch.grade}</td><td style={{padding:"10px 14px",fontSize:13}}><div>{ch.parentName||"-"}</div><div style={{fontSize:11,color:MU}}>{ch.parentPhone||""}</div></td><td style={{padding:"10px 14px"}}>{hasMed?(<span style={{fontSize:11,background:"#fee2e2",color:RE,borderRadius:4,padding:"2px 7px",fontWeight:500}}>Alert</span>):(<span style={{fontSize:11,color:MU}}>None</span>)}</td><td style={{padding:"10px 14px",fontSize:12,color:MU}}>{last?fd(last.date):"Never"}</td><td style={{padding:"10px 14px"}} onClick={e=>e.stopPropagation()}><Btn onClick={()=>{if(confirm("Remove "+ch.first+" "+ch.last+"?"))setChildren(cs=>cs.filter(c=>c.id!==ch.id));}} v="danger" style={{fontSize:11,padding:"4px 8px"}}>X</Btn></td></tr>);})}
            {filtered.length===0&&<tr><td colSpan={7} style={{padding:40,textAlign:"center",color:MU}}>No children registered.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Child":"Register New Child"} width={500}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="First Name *"><Inp value={form.first} onChange={v=>setForm(f=>({...f,first:v}))}/></Fld>
          <Fld label="Last Name *"><Inp value={form.last} onChange={v=>setForm(f=>({...f,last:v}))}/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Date of Birth"><Inp type="date" value={form.dob||""} onChange={v=>setForm(f=>({...f,dob:v}))}/></Fld>
          <Fld label="Level *"><select value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}><option value="">Select level</option>{CHURCH_LEVELS.map(l=><option key={l.name} value={l.name}>{l.label}</option>)}</select></Fld>
        </div>
        <Fld label="Parent (link to member)"><select value={form.parentMemberId||""} onChange={e=>{const id=+e.target.value||null;const m=members.find(x=>x.id===id);setForm(f=>({...f,parentMemberId:id,parentName:m?m.first+" "+m.last:f.parentName,parentPhone:m?m.phone:f.parentPhone}));}} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}><option value="">Not linked (manual entry)</option>{members.map(m=><option key={m.id} value={m.id}>{m.first} {m.last}</option>)}</select></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Parent Name"><Inp value={form.parentName||""} onChange={v=>setForm(f=>({...f,parentName:v}))}/></Fld>
          <Fld label="Parent Phone"><Inp value={form.parentPhone||""} onChange={v=>setForm(f=>({...f,parentPhone:v}))}/></Fld>
        </div>
        <Fld label="Emergency Pickup"><Inp value={form.emergencyPickup||""} onChange={v=>setForm(f=>({...f,emergencyPickup:v}))} placeholder="Grandma, Aunt..."/></Fld>
        <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{fontSize:11,color:RE,fontWeight:600,marginBottom:6}}>MEDICAL and ALLERGIES</div>
          <div style={{fontSize:11,color:MU,marginBottom:4}}>Allergies:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{CALLERGIES.map(a=>{const on=(form.allergies||[]).includes(a);return (<div key={a} onClick={()=>setForm(f=>({...f,allergies:on?f.allergies.filter(x=>x!==a):[...(f.allergies||[]),a]}))} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:on?"#fee2e2":W,color:on?RE:MU,border:"0.5px solid "+(on?"#fca5a5":BR),fontWeight:on?500:400}}>{a}</div>);})}</div>
          <div style={{fontSize:11,color:MU,marginBottom:4}}>Conditions:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{CMEDICAL.map(m=>{const on=(form.medical||[]).includes(m);return (<div key={m} onClick={()=>setForm(f=>({...f,medical:on?f.medical.filter(x=>x!==m):[...(f.medical||[]),m]}))} style={{fontSize:10,padding:"2px 7px",borderRadius:20,cursor:"pointer",background:on?"#eff6ff":W,color:on?BL:MU,border:"0.5px solid "+(on?BL+"55":BR),fontWeight:on?500:400}}>{m}</div>);})}</div>
          <Fld label="Medical Notes"><Inp value={form.medicalNotes||""} onChange={v=>setForm(f=>({...f,medicalNotes:v}))} placeholder="EpiPen location..."/></Fld>
        </div>
        <Fld label="Status"><Slt value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} opts={["Active","Inactive"]}/></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function ClassroomsManager({classrooms,setClassrooms,teacherSchedule,users,members,kidsCheckIns}){
  const [editModal,setEditModal]=useState(null);
  const [form,setForm]=useState({});
  const today=td();
  const openEdit=cl=>{setEditModal(cl);setForm({location:cl.location,capacity:cl.capacity,color:cl.color,name:cl.name});};
  const save=()=>{setClassrooms(cs=>cs.map(c=>c.id===editModal.id?{...c,...form}:c));setEditModal(null);};
  return(
    <div>
      <div style={{fontSize:13,color:MU,marginBottom:14}}>{classrooms.length} classrooms organized by age level. Click any to edit.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
        {classrooms.map(cl=>{const todayCI=kidsCheckIns.filter(ci=>ci.date===today&&ci.classroomId===cl.id&&!ci.checkedOut).length;const todaySch=teacherSchedule.find(t=>t.date===today&&t.classroomId===cl.id);const leadU=todaySch?.leadId&&users.find(u=>u.id===todaySch.leadId);const leadM=leadU&&members.find(m=>m.id===leadU.memberId);return (<div key={cl.id} onClick={()=>openEdit(cl)} style={{background:W,border:"1.5px solid "+cl.color+"33",borderRadius:12,overflow:"hidden",cursor:"pointer"}}><div style={{background:cl.color,color:"#fff",padding:"10px 14px",fontWeight:600}}>{cl.name}</div><div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4}}>Location</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{cl.location}</div></div><div><div style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4}}>Capacity</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{cl.capacity} kids</div></div></div><div style={{paddingTop:10,borderTop:"0.5px solid "+BR}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:10,color:MU,textTransform:"uppercase",letterSpacing:0.4}}>Today</span><span style={{fontSize:12,fontWeight:600,color:todayCI>0?cl.color:MU}}>{todayCI}/{cl.capacity}</span></div><div style={{fontSize:11,color:MU}}>{leadM?"Lead: "+leadM.first+" "+leadM.last:"No teacher today"}</div></div></div></div>);})}
      </div>
      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={editModal?"Edit "+editModal.name:""}>
        <Fld label="Display Name"><Inp value={form.name||""} onChange={v=>setForm(f=>({...f,name:v}))}/></Fld>
        <Fld label="Location"><Inp value={form.location||""} onChange={v=>setForm(f=>({...f,location:v}))}/></Fld>
        <Fld label="Capacity"><Inp type="number" value={form.capacity||""} onChange={v=>setForm(f=>({...f,capacity:+v||0}))}/></Fld>
        <Fld label="Color"><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{CL_COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid "+N:"3px solid transparent",boxSizing:"border-box"}}/>)}</div></Fld>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} v="success" style={{flex:1,justifyContent:"center"}}>Save</Btn>
          <Btn onClick={()=>setEditModal(null)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function TeacherScheduleMgr({classrooms,teacherSchedule,setTeacherSchedule,users,members,roles}){
  const getNextSundays=n=>{const t=new Date();const d=t.getDay();const days=d===0?0:7-d;const r=[];for(let i=-1;i<n;i++){const dt=new Date(t);dt.setDate(t.getDate()+days+(i*7));r.push(dt.toISOString().split("T")[0]);}return r;};
  const [selDate,setSelDate]=useState(td());
  const sundays=getNextSundays(6);
  const nid=useRef(800);
  const activeUsers=users.filter(u=>u.status==="Active");
  const getSch=(d,cid)=>teacherSchedule.find(t=>t.date===d&&t.classroomId===cid);
  const setLead=(cid,lid)=>{const ex=getSch(selDate,cid);if(ex)setTeacherSchedule(ts=>ts.map(t=>t.id===ex.id?{...t,leadId:+lid||null}:t));else setTeacherSchedule(ts=>[...ts,{id:nid.current++,date:selDate,classroomId:cid,leadId:+lid||null,helperIds:[]}]);};
  const togHelp=(cid,uid)=>{const ex=getSch(selDate,cid);if(ex){const h=ex.helperIds||[];const nh=h.includes(uid)?h.filter(x=>x!==uid):[...h,uid];setTeacherSchedule(ts=>ts.map(t=>t.id===ex.id?{...t,helperIds:nh}:t));}else setTeacherSchedule(ts=>[...ts,{id:nid.current++,date:selDate,classroomId:cid,leadId:null,helperIds:[uid]}]);};
  const copyPrev=()=>{const p=new Date(selDate+"T00:00:00");p.setDate(p.getDate()-7);const ps=p.toISOString().split("T")[0];const prev=teacherSchedule.filter(t=>t.date===ps);if(prev.length===0){alert("No schedule for "+fd(ps));return;}if(!confirm("Copy from "+fd(ps)+"?"))return;setTeacherSchedule(ts=>[...ts.filter(t=>t.date!==selDate),...prev.map(t=>({...t,id:nid.current++,date:selDate}))]);};
  const assigned=teacherSchedule.filter(t=>t.date===selDate&&t.leadId).length;
  return(
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:13,fontWeight:500,color:MU}}>Sunday:</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{sundays.map(d=><button key={d} onClick={()=>setSelDate(d)} style={{padding:"7px 12px",borderRadius:7,border:"1.5px solid "+(selDate===d?N:BR),background:selDate===d?N:W,color:selDate===d?"#fff":TX,fontSize:12,fontWeight:selDate===d?500:400,cursor:"pointer"}}>{fd(d)}</button>)}</div>
        <div style={{flex:1}}></div>
        <div style={{fontSize:12,color:MU}}>{assigned}/{classrooms.length} staffed</div>
        <Btn onClick={copyPrev} v="outline" style={{fontSize:12}}>Copy Previous Week</Btn>
      </div>
      {activeUsers.length===0&&<div style={{padding:14,background:"#fef9c3",border:"0.5px solid #fde047",borderRadius:10,fontSize:13,color:"#713f12",marginBottom:14}}><strong>No active users.</strong> Go to Access Control to add teachers as users first.</div>}
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f8f9fc"}}><th style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR,width:"22%"}}>Classroom</th><th style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR,width:"32%"}}>Lead Teacher</th><th style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:MU,textTransform:"uppercase",letterSpacing:0.5,borderBottom:"0.5px solid "+BR}}>Helpers</th></tr></thead>
          <tbody>
            {classrooms.map(cl=>{const sch=getSch(selDate,cl.id);return (<tr key={cl.id} style={{borderBottom:"0.5px solid "+BR}}><td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:cl.color}}></div><div><div style={{fontSize:13,fontWeight:500,color:cl.color}}>{cl.name}</div><div style={{fontSize:10,color:MU}}>{cl.location}</div></div></div></td><td style={{padding:"10px 14px"}}><select value={sch?.leadId||""} onChange={e=>setLead(cl.id,e.target.value)} style={{width:"100%",padding:"6px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",background:W,boxSizing:"border-box"}}><option value="">— No lead —</option>{activeUsers.map(u=>{const m=members.find(x=>x.id===u.memberId);const r=roles.find(x=>x.id===u.roleId);return m?<option key={u.id} value={u.id}>{m.first} {m.last}{r?" ("+r.name+")":""}</option>:null;})}</select></td><td style={{padding:"10px 14px"}}><div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>{(sch?.helperIds||[]).map(uid=>{const u=users.find(x=>x.id===uid);const m=u&&members.find(x=>x.id===u.memberId);return m?<span key={uid} onClick={()=>togHelp(cl.id,uid)} style={{fontSize:11,background:cl.color+"18",color:cl.color,borderRadius:10,padding:"2px 8px",fontWeight:500,cursor:"pointer",border:"0.5px solid "+cl.color+"44"}}>{m.first} {m.last} x</span>:null;})}<select value="" onChange={e=>e.target.value&&togHelp(cl.id,+e.target.value)} style={{fontSize:11,padding:"3px 7px",border:"0.5px dashed "+BR,borderRadius:10,background:"transparent",cursor:"pointer",outline:"none"}}><option value="">+ Add helper</option>{activeUsers.filter(u=>!(sch?.helperIds||[]).includes(u.id)&&u.id!==sch?.leadId).map(u=>{const m=members.find(x=>x.id===u.memberId);return m?<option key={u.id} value={u.id}>{m.first} {m.last}</option>:null;})}</select></div></td></tr>);})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CLASS ROLL CALL ──
function ClassRollCall({classrooms,children,rollCalls,setRollCalls,teacherSchedule,users,members,cs}){
  const [selDate,setSelDate]=useState(td());
  const [selClassId,setSelClassId]=useState((classrooms.find((c:any)=>c.id<=6)||classrooms[0])?.id||0);
  const [notes,setNotes]=useState("");
  const [saved,setSaved]=useState(false);
  const selClass=classrooms.find((c:any)=>c.id===selClassId);
  const roster=children.filter((c:any)=>c.status==="Active"&&c.grade===selClass?.grade);
  const existing=rollCalls.find((r:any)=>r.date===selDate&&r.classroomId===selClassId);
  useEffect(()=>{setNotes((rollCalls.find((r:any)=>r.date===selDate&&r.classroomId===selClassId) as any)?.teacherNotes||"");},[selDate,selClassId]);
  const getStatus=(childId:any)=>(existing as any)?.entries?.find((e:any)=>e.childId===childId)?.status||"";
  const setEntry=(childId:any,status:any)=>{
    setRollCalls((prev:any)=>{
      const ex=prev.find((r:any)=>r.date===selDate&&r.classroomId===selClassId);
      if(ex){
        const ents=ex.entries.some((e:any)=>e.childId===childId)?ex.entries.map((e:any)=>e.childId===childId?{...e,status}:e):[...ex.entries,{childId,status}];
        return prev.map((r:any)=>r.id===ex.id?{...r,entries:ents}:r);
      }else{
        const ents=roster.map((ch:any)=>({childId:ch.id,status:ch.id===childId?status:""}));
        return[...prev,{id:Date.now(),date:selDate,classroomId:selClassId,entries:ents,teacherNotes:"",completedAt:null}];
      }
    });
  };
  const saveNotes=()=>{
    setRollCalls((prev:any)=>{
      const ex=prev.find((r:any)=>r.date===selDate&&r.classroomId===selClassId);
      if(ex)return prev.map((r:any)=>r.id===ex.id?{...r,teacherNotes:notes,completedAt:new Date().toISOString()}:r);
      return[...prev,{id:Date.now(),date:selDate,classroomId:selClassId,entries:[],teacherNotes:notes,completedAt:new Date().toISOString()}];
    });
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const presentN=((existing as any)?.entries||[]).filter((e:any)=>e.status==="Present").length;
  const absentN=((existing as any)?.entries||[]).filter((e:any)=>e.status==="Absent").length;
  const excusedN=((existing as any)?.entries||[]).filter((e:any)=>e.status==="Excused").length;
  const contactParent=(ch:any)=>{if(ch.parentPhone){(window as any).__openSmsComposer__&&(window as any).__openSmsComposer__({phone:ch.parentPhone,name:ch.parentName||"Parent",category:"Follow-Up",body:"Hi "+(ch.parentName?.split(" ")[0]||"there")+", this is "+((cs as any)?.name||"the church")+" reaching out about "+ch.first+". Please give us a call. Thank you!"});}};
  const todaySch=(teacherSchedule as any[]).filter((t:any)=>t.date===selDate&&t.classroomId===selClassId);
  const leadU=todaySch[0]?.leadId&&(users as any[]).find((u:any)=>u.id===todaySch[0].leadId);
  const leadM=leadU&&(members as any[]).find((m:any)=>m.id===leadU.memberId);
  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><div style={{fontSize:11,color:MU,marginBottom:4,fontWeight:500,textTransform:"uppercase" as any,letterSpacing:0.5}}>Date</div><input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/></div>
        <div style={{flex:1}}><div style={{fontSize:11,color:MU,marginBottom:4,fontWeight:500,textTransform:"uppercase" as any,letterSpacing:0.5}}>Classroom</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(classrooms as any[]).filter((cl:any)=>cl.id<=6).map((cl:any)=><button key={cl.id} onClick={()=>setSelClassId(cl.id)} style={{padding:"7px 12px",borderRadius:7,border:"1.5px solid "+(selClassId===cl.id?cl.color:BR),background:selClassId===cl.id?cl.color+"14":W,color:selClassId===cl.id?cl.color:TX,fontSize:12,fontWeight:selClassId===cl.id?600:400,cursor:"pointer"}}>{cl.name}</button>)}</div></div>
      </div>
      {selClass&&(<div>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:10,padding:"10px 16px",flex:2,minWidth:140}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.5}}>Lead Teacher</div><div style={{fontSize:13,fontWeight:500,color:N,marginTop:3}}>{leadM?(leadM as any).first+" "+(leadM as any).last:"Not assigned"}</div></div>
          <div style={{background:"#dcfce7",border:"0.5px solid #86efac",borderRadius:10,padding:"10px 16px",flex:1,minWidth:70,textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.5}}>Present</div><div style={{fontSize:22,fontWeight:700,color:GR}}>{presentN}</div></div>
          <div style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:10,padding:"10px 16px",flex:1,minWidth:70,textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.5}}>Absent</div><div style={{fontSize:22,fontWeight:700,color:RE}}>{absentN}</div></div>
          <div style={{background:"#fef3c7",border:"0.5px solid #fde68a",borderRadius:10,padding:"10px 16px",flex:1,minWidth:70,textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.5}}>Excused</div><div style={{fontSize:22,fontWeight:700,color:AM}}>{excusedN}</div></div>
        </div>
        {roster.length===0?(
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:36,textAlign:"center" as any}}><div style={{fontSize:13,fontWeight:500,color:N,marginBottom:6}}>No children in {(selClass as any).name}</div><div style={{fontSize:12,color:MU}}>Go to the Children tab and set their level to "{(selClass as any).name}" to add them here.</div></div>
        ):(
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden",marginBottom:14}}>
            <div style={{padding:"10px 16px",background:"#f8f9fc",borderBottom:"0.5px solid "+BR,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:13,fontWeight:500,color:N}}>{(selClass as any).name} Roll Call — {fd(selDate)}</div><div style={{fontSize:11,color:MU}}>{roster.length} on roster</div></div>
            {(roster as any[]).map((ch:any)=>{const st=getStatus(ch.id);return(
              <div key={ch.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"0.5px solid "+BR+"66"}}>
                <Av f={ch.first} l={ch.last} sz={34}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500}}>{ch.first} {ch.last}</div><div style={{fontSize:11,color:MU}}>Age {calcAge(ch.dob)}{ch.parentName?" · "+ch.parentName:""}</div></div>
                <div style={{display:"flex",gap:5}}>
                  {([["Present","P",GR,"#dcfce7"],["Absent","A",RE,"#fee2e2"],["Excused","E",AM,"#fef3c7"]] as any[]).map(([lbl,sh,col,bg]:any)=>(
                    <button key={lbl} onClick={()=>setEntry(ch.id,st===lbl?"":lbl)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid "+(st===lbl?col:BR),background:st===lbl?bg:W,color:st===lbl?col:MU,fontSize:12,fontWeight:st===lbl?600:400,cursor:"pointer",minWidth:34}}>{sh}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:4}}>
                  {ch.parentPhone&&<a href={"tel:"+ch.parentPhone.replace(/\D/g,"")} style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:7,background:"#dcfce7",border:"0.5px solid #86efac",textDecoration:"none",fontSize:15}} title={"Call "+ch.parentName}>📞</a>}
                  {ch.parentPhone&&<button onClick={()=>contactParent(ch)} style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:7,background:"#eff6ff",border:"0.5px solid #93c5fd",cursor:"pointer",fontSize:15}} title={"Text "+ch.parentName}>💬</button>}
                </div>
              </div>
            );})}
          </div>
        )}
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:10,padding:14}}>
          <div style={{fontSize:12,fontWeight:500,color:N,marginBottom:8}}>Session Notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Lesson topic, class behavior, special prayer requests, events..." style={{width:"100%",padding:"9px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical" as any,boxSizing:"border-box" as any,lineHeight:1.7}}/>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><Btn onClick={saveNotes} v={saved?"success":"primary"} style={{fontSize:12}}>{saved?"✓ Saved!":"Save Roll Call"}</Btn></div>
        </div>
      </div>)}
    </div>
  );
}

// ── CHILD PROGRESS ──
function ChildProgress({children,classrooms,rollCalls,progressNotes,setProgressNotes,cs}:any){
  const [selChildId,setSelChildId]=useState(0);
  const [search,setSearch]=useState("");
  const [addNote,setAddNote]=useState(false);
  const [noteForm,setNoteForm]=useState({type:"spiritual",note:"",verse:"",lessonCompleted:false,date:td()});
  const activeKids=(children as any[]).filter((c:any)=>c.status==="Active");
  const filtered=search?activeKids.filter((c:any)=>(c.first+" "+c.last).toLowerCase().includes(search.toLowerCase())):activeKids;
  const selChild=(children as any[]).find((c:any)=>c.id===selChildId);
  const childEntries=(rollCalls as any[]).flatMap((r:any)=>r.entries.filter((e:any)=>e.childId===selChildId).map((e:any)=>({...e,date:r.date})));
  const presentN=childEntries.filter((e:any)=>e.status==="Present").length;
  const absentN=childEntries.filter((e:any)=>e.status==="Absent").length;
  const excusedN=childEntries.filter((e:any)=>e.status==="Excused").length;
  const attRate=childEntries.length>0?Math.round(presentN/childEntries.length*100):null;
  const childNotes=(progressNotes as any[]).filter((n:any)=>n.childId===selChildId).sort((a:any,b:any)=>b.date.localeCompare(a.date));
  const addProgressNote=()=>{
    if(!noteForm.note.trim()&&!noteForm.verse&&!noteForm.lessonCompleted){alert("Add at least a note, verse, or check lesson completed.");return;}
    setProgressNotes((n:any)=>[...n,{...noteForm,id:Date.now(),childId:selChildId,timestamp:new Date().toISOString()}]);
    setNoteForm({type:"spiritual",note:"",verse:"",lessonCompleted:false,date:td()});
    setAddNote(false);
  };
  const typeColors:any={spiritual:PU,academic:BL,behavioral:AM};
  return(
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:14,alignItems:"start"}}>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",borderBottom:"0.5px solid "+BR}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:"100%",padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",boxSizing:"border-box" as any}}/></div>
        <div style={{maxHeight:580,overflowY:"auto" as any}}>
          {filtered.map((ch:any)=>{
            const ents=(rollCalls as any[]).flatMap((r:any)=>r.entries.filter((e:any)=>e.childId===ch.id));
            const rate=ents.length>0?Math.round(ents.filter((e:any)=>e.status==="Present").length/ents.length*100):null;
            const notesCt=(progressNotes as any[]).filter((n:any)=>n.childId===ch.id).length;
            return(<div key={ch.id} onClick={()=>setSelChildId(ch.id)} style={{padding:"9px 12px",borderBottom:"0.5px solid "+BR+"44",cursor:"pointer",background:selChildId===ch.id?N+"08":W,display:"flex",alignItems:"center",gap:8}} onMouseEnter={(e:any)=>e.currentTarget.style.background=N+"06"} onMouseLeave={(e:any)=>e.currentTarget.style.background=selChildId===ch.id?N+"08":W}>
              <Av f={ch.first} l={ch.last} sz={26}/>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,overflow:"hidden",whiteSpace:"nowrap" as any,textOverflow:"ellipsis"}}>{ch.first} {ch.last}</div><div style={{fontSize:10,color:rate===null?MU:rate>=80?GR:rate>=60?AM:RE}}>{ch.grade}{rate!==null?" · "+rate+"%":""}</div></div>
              {notesCt>0&&<span style={{fontSize:9,background:PU+"22",color:PU,borderRadius:10,padding:"1px 5px",flexShrink:0}}>{notesCt}</span>}
            </div>);
          })}
          {filtered.length===0&&<div style={{padding:20,textAlign:"center" as any,color:MU,fontSize:12}}>No children found.</div>}
        </div>
      </div>
      {!selChild?(
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center" as any}}><div style={{fontSize:16,color:N,fontWeight:500,marginBottom:8}}>Select a child</div><div style={{fontSize:13,color:MU}}>Click any child on the left to view their progress profile.</div></div>
      ):(
        <div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <Av f={selChild.first} l={selChild.last} sz={50}/>
              <div style={{flex:1}}><div style={{fontSize:18,fontWeight:600,color:N}}>{selChild.first} {selChild.last}</div><div style={{fontSize:12,color:MU}}>{selChild.grade} · Age {calcAge(selChild.dob)}{selChild.parentName?" · "+selChild.parentName:""}</div></div>
              <div style={{display:"flex",gap:6}}>
                {selChild.parentPhone&&<a href={"tel:"+selChild.parentPhone.replace(/\D/g,"")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:8,background:"#dcfce7",border:"0.5px solid #86efac",textDecoration:"none",fontSize:12,color:"#14532d",fontWeight:500}}>📞 Call</a>}
                {selChild.parentPhone&&<button onClick={()=>(window as any).__openSmsComposer__&&(window as any).__openSmsComposer__({phone:selChild.parentPhone,name:selChild.parentName||"Parent",category:"Follow-Up",body:"Hi "+(selChild.parentName?.split(" ")[0]||"there")+", this is "+((cs as any)?.name||"the church")+" checking in about "+selChild.first+". "})} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:8,background:"#eff6ff",border:"0.5px solid "+BL+"55",cursor:"pointer",fontSize:12,color:BL,fontWeight:500}}>💬 Text</button>}
              </div>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {([[attRate!==null?attRate+"%":"—","Attendance",attRate===null?MU:attRate>=80?GR:attRate>=60?AM:RE],[presentN,"Present",GR],[absentN,"Absent",RE],[excusedN,"Excused",AM],[childNotes.filter((n:any)=>n.verse).length,"Verses",G],[childNotes.length,"Notes",PU]] as any[]).map(([v,l,c]:any)=>(
                <div key={l} style={{background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"8px 14px",flex:1,minWidth:70,textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.5}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div></div>
              ))}
            </div>
          </div>
          <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:14,fontWeight:500,color:N}}>Progress Log</div><Btn onClick={()=>setAddNote((v:any)=>!v)} v={addNote?"ghost":"gold"} style={{fontSize:12}}>+ Add Entry</Btn></div>
            {addNote&&(
              <div style={{background:BG,border:"0.5px solid "+BR,borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <Fld label="Type"><select value={noteForm.type} onChange={e=>setNoteForm((f:any)=>({...f,type:e.target.value}))} style={{width:"100%",padding:"7px 10px",border:"0.5px solid "+BR,borderRadius:7,fontSize:12,outline:"none",background:W,boxSizing:"border-box" as any}}><option value="spiritual">Spiritual</option><option value="academic">Academic</option><option value="behavioral">Behavioral</option></select></Fld>
                  <Fld label="Date"><Inp type="date" value={noteForm.date} onChange={(v:any)=>setNoteForm((f:any)=>({...f,date:v}))}/></Fld>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"4px 0"}}><input type="checkbox" checked={noteForm.lessonCompleted} onChange={e=>setNoteForm((f:any)=>({...f,lessonCompleted:e.target.checked}))} id="lcpg" style={{width:16,height:16,cursor:"pointer"}}/><label htmlFor="lcpg" style={{fontSize:13,color:TX,cursor:"pointer"}}>Lesson Completed</label></div>
                <Fld label="Bible Verse Memorized (optional)"><Inp value={noteForm.verse} onChange={(v:any)=>setNoteForm((f:any)=>({...f,verse:v}))} placeholder="e.g. John 3:16 — For God so loved the world..."/></Fld>
                <Fld label="Note"><textarea value={noteForm.note} onChange={e=>setNoteForm((f:any)=>({...f,note:e.target.value}))} rows={3} placeholder="Describe participation, behavior, spiritual growth, or concerns..." style={{width:"100%",padding:"9px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical" as any,boxSizing:"border-box" as any,lineHeight:1.7}}/></Fld>
                <div style={{display:"flex",gap:8}}><Btn onClick={addProgressNote} v="success" style={{flex:1,justifyContent:"center"}}>Save Entry</Btn><Btn onClick={()=>setAddNote(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn></div>
              </div>
            )}
            {childNotes.length===0&&!addNote&&<div style={{textAlign:"center" as any,padding:32,color:MU,fontSize:13}}>No progress entries yet for {selChild.first}.</div>}
            {childNotes.map((n:any)=>(
              <div key={n.id} style={{padding:"12px 14px",background:BG,border:"0.5px solid "+BR,borderRadius:8,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:10,background:typeColors[n.type]+"22",color:typeColors[n.type],borderRadius:20,padding:"2px 9px",fontWeight:600,textTransform:"capitalize" as any}}>{n.type}</span>
                    {n.lessonCompleted&&<span style={{fontSize:10,background:"#dcfce7",color:GR,borderRadius:20,padding:"2px 9px",fontWeight:500}}>✓ Lesson</span>}
                    {n.verse&&<span style={{fontSize:10,background:GL+"44",color:"#7a5c10",borderRadius:20,padding:"2px 9px",fontWeight:500}}>📖 Verse</span>}
                  </div>
                  <div style={{fontSize:11,color:MU}}>{fd(n.date)}</div>
                </div>
                {n.verse&&<div style={{fontSize:12,color:"#7a5c10",fontStyle:"italic" as any,marginBottom:5,background:GL+"22",borderRadius:6,padding:"4px 10px"}}>"{n.verse}"</div>}
                {n.note&&<div style={{fontSize:13,color:TX,lineHeight:1.6}}>{n.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EdReports({classrooms,children,kidsCheckIns,teacherSchedule,users,members,rollCalls}:any){
  const month="2026-04";
  const monthCI=(kidsCheckIns as any[]).filter((ci:any)=>ci.date.startsWith(month));
  const classStats=(classrooms as any[]).map((cl:any)=>{const ciN=monthCI.filter((ci:any)=>ci.classroomId===cl.id).length;const uniq=new Set(monthCI.filter((ci:any)=>ci.classroomId===cl.id).map((ci:any)=>ci.childId)).size;const staffed=(teacherSchedule as any[]).filter((t:any)=>t.classroomId===cl.id&&t.leadId&&t.date.startsWith(month)).length;return {cl,ciN,uniq,staffed};});
  const teachStats=(users as any[]).filter((u:any)=>u.status==="Active").map((u:any)=>{const leads=(teacherSchedule as any[]).filter((t:any)=>t.leadId===u.id).length;const helps=(teacherSchedule as any[]).filter((t:any)=>(t.helperIds||[]).includes(u.id)).length;const m=(members as any[]).find((x:any)=>x.id===u.memberId);return {u,m,leads,helps,total:leads+helps};}).filter((s:any)=>s.total>0).sort((a:any,b:any)=>b.total-a.total);
  const totalKids=(children as any[]).filter((c:any)=>c.status==="Active").length;
  const monthN=monthCI.length;
  const allRollDates=[...new Set((rollCalls as any[]).map((r:any)=>r.date))];
  const totalSundays=allRollDates.length||1;
  const perfData=(classrooms as any[]).filter((cl:any)=>cl.id<=6).map((cl:any)=>{
    const clRC=(rollCalls as any[]).filter((r:any)=>r.classroomId===cl.id);
    const allE=clRC.flatMap((r:any)=>r.entries);
    const markedE=allE.filter((e:any)=>e.status);
    const presentE=allE.filter((e:any)=>e.status==="Present");
    const attRate=markedE.length>0?Math.round(presentE.length/markedE.length*100):null;
    const datesStaffed=allRollDates.filter((d:any)=>(teacherSchedule as any[]).some((t:any)=>t.date===d&&t.classroomId===cl.id&&t.leadId)).length;
    const teachRate=Math.round(datesStaffed/totalSundays*100);
    const combined=attRate!==null?Math.round((attRate+teachRate)/2):null;
    const roster=(children as any[]).filter((c:any)=>c.status==="Active"&&c.grade===cl.grade).length;
    return {cl,attRate,teachRate:allRollDates.length>0?teachRate:null,combined,roster,sessions:clRC.length};
  }).sort((a:any,b:any)=>((b.combined??-1)-(a.combined??-1)));
  return(
    <div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <Stat label="Active Children" value={totalKids} color={BL}/>
        <Stat label="April Check-Ins" value={monthN} color={GR}/>
        <Stat label="Avg per Sunday" value={monthN?Math.round(monthN/4):0} color={N}/>
        <Stat label="Classrooms" value={(classrooms as any[]).length} color={G}/>
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 4px"}}>Classroom Performance Leaderboard</h3>
        <div style={{fontSize:11,color:MU,marginBottom:14}}>Score = average of attendance rate and teacher staffing consistency</div>
        {(rollCalls as any[]).length===0?(
          <div style={{textAlign:"center" as any,padding:24,color:MU,fontSize:12}}>Take roll call in the Roll Call tab to see performance data here.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {perfData.map(({cl,attRate,teachRate,combined,roster,sessions}:any,idx:number)=>(
              <div key={cl.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:idx===0?"#f0fdf4":BG,borderRadius:8,border:"0.5px solid "+(idx===0?"#86efac":BR)}}>
                <div style={{fontSize:18,fontWeight:700,color:idx===0?GR:idx===1?G:MU,minWidth:22,textAlign:"center" as any}}>{idx===0?"🏆":idx===1?"🥈":idx+1}</div>
                <div style={{width:10,height:10,borderRadius:"50%",background:cl.color,flexShrink:0}}></div>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:cl.color}}>{cl.name}</div><div style={{fontSize:11,color:MU}}>{roster} on roster · {sessions} roll call{sessions!==1?"s":""} taken</div></div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.4}}>Attendance</div><div style={{fontSize:14,fontWeight:600,color:attRate===null?MU:attRate>=80?GR:attRate>=60?AM:RE}}>{attRate!==null?attRate+"%":"—"}</div></div>
                  <div style={{textAlign:"center" as any}}><div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.4}}>Staffing</div><div style={{fontSize:14,fontWeight:600,color:teachRate===null?MU:teachRate>=80?GR:teachRate>=60?AM:RE}}>{teachRate!==null?teachRate+"%":"—"}</div></div>
                  <div style={{background:combined===null?BR:combined>=80?"#dcfce7":combined>=60?"#fef3c7":"#fee2e2",borderRadius:8,padding:"6px 12px",textAlign:"center" as any,minWidth:55}}>
                    <div style={{fontSize:10,color:MU,textTransform:"uppercase" as any,letterSpacing:0.4}}>Score</div>
                    <div style={{fontSize:16,fontWeight:700,color:combined===null?MU:combined>=80?GR:combined>=60?AM:RE}}>{combined!==null?combined+"%":"—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Classroom Check-In — April</h3>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>{classStats.map(({cl,ciN,uniq,staffed}:any)=>(<div key={cl.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}><div style={{width:8,height:8,borderRadius:"50%",background:cl.color}}></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:cl.color}}>{cl.name}</div><div style={{fontSize:11,color:MU}}>{uniq} unique kids · {staffed} Sundays staffed</div></div><div style={{textAlign:"right" as any}}><div style={{fontSize:16,fontWeight:700,color:N}}>{ciN}</div><div style={{fontSize:10,color:MU}}>check-ins</div></div></div>))}</div>
      </div>
      {teachStats.length>0&&<div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:18}}>
        <h3 style={{fontSize:14,fontWeight:500,color:N,margin:"0 0 14px"}}>Teacher Service Report</h3>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>{teachStats.map(({u,m,leads,helps,total}:any)=>m?(<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:BG,borderRadius:8,border:"0.5px solid "+BR}}><Av f={m.first} l={m.last} sz={30}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.first} {m.last}</div><div style={{fontSize:11,color:MU}}>{leads} lead · {helps} helper</div></div><div style={{textAlign:"right" as any}}><div style={{fontSize:16,fontWeight:700,color:GR}}>{total}</div><div style={{fontSize:10,color:MU}}>weeks</div></div></div>):null)}</div>
      </div>}
    </div>
  );
}

// ── INCIDENT REPORTS ──
const INCIDENT_TYPES=["Behavioral","Medical / Health","Safety","Property Damage","Bullying / Harassment"];
const INCIDENT_SEVERITIES=[
  {key:"Low",color:"#16a34a",bg:"#dcfce7"},
  {key:"Medium",color:"#d97706",bg:"#fef3c7"},
  {key:"High",color:"#dc2626",bg:"#fee2e2"},
  {key:"Critical",color:"#7c3aed",bg:"#ede9fe"},
];
const INCIDENT_STATUSES=["Open","In Progress","Resolved"];

function IncidentReports({incidents,setIncidents,children,classrooms,members,cs}){
  const [subTab,setSubTab]=useState("log");
  const [modal,setModal]=useState(false);
  const [detail,setDetail]=useState(null);
  const nid=useRef(5000);

  // New report form state
  const [form,setForm]=useState({childId:"",classroomId:"",type:"Behavioral",severity:"Medium",date:td(),time:"",description:"",witnesses:"",actionTaken:"",reportedBy:"",status:"Open"});
  const resetForm=()=>setForm({childId:"",classroomId:"",type:"Behavioral",severity:"Medium",date:td(),time:new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false}),description:"",witnesses:"",actionTaken:"",reportedBy:"",status:"Open"});

  const openNew=()=>{resetForm();setModal(true);};
  const submit=()=>{
    if(!form.childId||!form.description.trim()){alert("Child and description are required.");return;}
    const entry={...form,id:nid.current++,timestamp:new Date().toISOString(),childId:+form.childId,classroomId:+form.classroomId||null};
    setIncidents(r=>[entry,...r]);
    setModal(false);
  };

  const updateStatus=(id,status)=>setIncidents(r=>r.map(i=>i.id===id?{...i,status,resolvedAt:status==="Resolved"?new Date().toISOString():i.resolvedAt}:i));
  const deleteReport=(id)=>{if(confirm("Permanently delete this incident report?"))setIncidents(r=>r.filter(i=>i.id!==id));};

  const [filterType,setFilterType]=useState("all");
  const [filterSev,setFilterSev]=useState("all");
  const [filterStatus,setFilterStatus]=useState("all");
  const [search,setSearch]=useState("");

  const filtered=incidents.filter(i=>{
    if(filterType!=="all"&&i.type!==filterType)return false;
    if(filterSev!=="all"&&i.severity!==filterSev)return false;
    if(filterStatus!=="all"&&i.status!==filterStatus)return false;
    if(search){
      const ch=children.find(c=>c.id===i.childId);
      const name=ch?ch.first+" "+ch.last:"";
      if(!name.toLowerCase().includes(search.toLowerCase())&&!i.description.toLowerCase().includes(search.toLowerCase()))return false;
    }
    return true;
  });

  const openCount=incidents.filter(i=>i.status!=="Resolved").length;

  const sevStyle=sev=>{const s=INCIDENT_SEVERITIES.find(x=>x.key===sev)||INCIDENT_SEVERITIES[1];return{color:s.color,background:s.bg,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600};};
  const statusStyle=st=>({Open:{background:"#fee2e2",color:RE},["In Progress"]:{background:"#fef3c7",color:AM},Resolved:{background:"#dcfce7",color:GR}}[st]||{});

  const contactParent=(incident)=>{
    const ch=children.find(c=>c.id===incident.childId);
    if(!ch)return;
    const parentName=ch.parentName||"Parent";
    const parentPhone=ch.parentPhone||"";
    const parentEmail=""; // could be linked from members
    const body=`Dear ${parentName},\n\nWe want to inform you about an incident involving ${ch.first} on ${fd(incident.date)}.\n\nType: ${incident.type}\nDescription: ${incident.description}\n${incident.actionTaken?"Action Taken: "+incident.actionTaken:""}\n\nPlease contact us if you have any questions.\n\n— ${cs?.pastorName||"Pastor"}, ${cs?.name||"Church"}`;
    const subject=`Incident Report — ${ch.first} ${ch.last} — ${fd(incident.date)}`;
    if(parentPhone){
      window.__openSmsComposer__&&window.__openSmsComposer__({phone:parentPhone,name:parentName,body:`Hi ${parentName}, please see the incident report for ${ch.first} dated ${fd(incident.date)}. Please call us to discuss. — ${cs?.name||"Church"}`,category:"Safety"});
    } else if(window.__openEmailComposer__){
      window.__openEmailComposer__({to:parentEmail,toName:parentName,subject,body,category:"Safety",relatedType:"incident",relatedId:incident.id});
    } else {
      alert("No contact info on file for "+ch.first+"'s parent. Add phone/email to child record.");
    }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,color:N,margin:0}}>Incident Reports</h3>
          <div style={{fontSize:12,color:MU,marginTop:2}}>Document and track classroom incidents involving children</div>
        </div>
        <Btn onClick={openNew} v="danger">+ File Incident Report</Btn>
      </div>

      {/* Summary stats */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Stat label="Total Reports" value={incidents.length} color={N}/>
        <Stat label="Open" value={incidents.filter(i=>i.status==="Open").length} color={RE}/>
        <Stat label="In Progress" value={incidents.filter(i=>i.status==="In Progress").length} color={AM}/>
        <Stat label="Resolved" value={incidents.filter(i=>i.status==="Resolved").length} color={GR}/>
      </div>

      {openCount>0&&(
        <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:12,color:RE,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>⚠</span>
          <div><strong>{openCount} unresolved incident{openCount!==1?"s":""}</strong> require{openCount===1?"s":""} follow-up. Review and update statuses below.</div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search child or description..." style={{flex:1,minWidth:160,padding:"8px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none"}}/>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
          <option value="all">All types</option>
          {INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterSev} onChange={e=>setFilterSev(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
          <option value="all">All severities</option>
          {INCIDENT_SEVERITIES.map(s=><option key={s.key} value={s.key}>{s.key}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:12,outline:"none",background:W}}>
          <option value="all">All statuses</option>
          {INCIDENT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length===0?(
        <div style={{background:W,border:"0.5px solid "+BR,borderRadius:12,padding:48,textAlign:"center"}}>
          <h3 style={{fontSize:15,fontWeight:500,color:N,marginBottom:6}}>{incidents.length===0?"No incidents reported":"No incidents match your filters"}</h3>
          <p style={{fontSize:13,color:MU,marginBottom:16}}>{incidents.length===0?"Praise God! Click below if an incident needs to be documented.":""}</p>
          {incidents.length===0&&<Btn onClick={openNew} v="danger">+ File First Report</Btn>}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(inc=>{
            const ch=children.find(c=>c.id===inc.childId);
            const cl=classrooms.find(c=>c.id===inc.classroomId);
            const sv=INCIDENT_SEVERITIES.find(s=>s.key===inc.severity)||INCIDENT_SEVERITIES[1];
            const isOpen=inc.status!=="Resolved";
            return(
              <div key={inc.id} style={{background:W,border:"1.5px solid "+(inc.severity==="Critical"?PU:inc.severity==="High"?RE+"55":BR),borderRadius:12,overflow:"hidden"}}>
                {/* Severity stripe */}
                <div style={{height:4,background:sv.color,width:"100%"}}/>
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Av f={ch?.first||"?"} l={ch?.last||""} sz={36}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:N}}>{ch?ch.first+" "+ch.last:"Unknown child"}</div>
                        <div style={{fontSize:11,color:MU}}>{cl?.name||"No classroom"} · {fd(inc.date)}{inc.time?" at "+inc.time:""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={sevStyle(inc.severity)}>{inc.severity}</span>
                      <span style={{...statusStyle(inc.status),borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500}}>{inc.status}</span>
                      <span style={{fontSize:11,background:"#ede9fe",color:PU,borderRadius:20,padding:"2px 9px",fontWeight:500}}>{inc.type}</span>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:TX,background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"10px 12px",lineHeight:1.7,marginBottom:10}}>{inc.description}</div>
                  {inc.actionTaken&&<div style={{fontSize:12,color:MU,marginBottom:8}}><strong>Action taken:</strong> {inc.actionTaken}</div>}
                  {inc.witnesses&&<div style={{fontSize:12,color:MU,marginBottom:8}}><strong>Witnesses:</strong> {inc.witnesses}</div>}
                  {inc.reportedBy&&<div style={{fontSize:12,color:MU,marginBottom:8}}><strong>Reported by:</strong> {inc.reportedBy}</div>}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",paddingTop:10,borderTop:"0.5px solid "+BR}}>
                    {isOpen&&<>
                      {inc.status==="Open"&&<Btn onClick={()=>updateStatus(inc.id,"In Progress")} v="outline" style={{fontSize:11,padding:"4px 10px"}}>Mark In Progress</Btn>}
                      <Btn onClick={()=>updateStatus(inc.id,"Resolved")} v="success" style={{fontSize:11,padding:"4px 10px"}}>Mark Resolved</Btn>
                    </>}
                    {!isOpen&&<Btn onClick={()=>updateStatus(inc.id,"Open")} v="ghost" style={{fontSize:11,padding:"4px 10px"}}>Reopen</Btn>}
                    <Btn onClick={()=>contactParent(inc)} v="gold" style={{fontSize:11,padding:"4px 10px"}}>Contact Parent</Btn>
                    <Btn onClick={()=>setDetail(inc)} v="ghost" style={{fontSize:11,padding:"4px 10px"}}>Edit</Btn>
                    <Btn onClick={()=>deleteReport(inc.id)} v="danger" style={{fontSize:11,padding:"4px 10px",marginLeft:"auto"}}>Delete</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File new report modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="File Incident Report" width={560}>
        <div style={{background:"#fff5f5",border:"0.5px solid #fca5a5",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:12,color:RE,lineHeight:1.6}}>
          Only lead teachers and administrators should file incident reports. All reports are permanently logged.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Child *">
            <select value={form.childId} onChange={e=>setForm(f=>({...f,childId:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
              <option value="">— Select child —</option>
              {[...children].sort((a,b)=>(a.first+a.last).localeCompare(b.first+b.last)).filter(c=>c.status==="Active").map(c=><option key={c.id} value={c.id}>{c.first} {c.last} ({c.grade})</option>)}
            </select>
          </Fld>
          <Fld label="Classroom">
            <select value={form.classroomId} onChange={e=>setForm(f=>({...f,classroomId:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
              <option value="">— Select classroom —</option>
              {classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Fld label="Incident Type">
            <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
              {INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Fld>
          <Fld label="Severity">
            <select value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",background:W,boxSizing:"border-box"}}>
              {INCIDENT_SEVERITIES.map(s=><option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
          </Fld>
          <Fld label="Date">
            <Inp type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
          </Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Fld label="Time of Incident"><Inp value={form.time} onChange={v=>setForm(f=>({...f,time:v}))} placeholder="e.g. 10:30 AM"/></Fld>
          <Fld label="Reported By"><Inp value={form.reportedBy} onChange={v=>setForm(f=>({...f,reportedBy:v}))} placeholder="Teacher name"/></Fld>
        </div>
        <Fld label="Description of Incident *">
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={4} placeholder={"Describe what happened, when, and where. Be factual and specific."} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>
        <Fld label="Action Taken">
          <textarea value={form.actionTaken} onChange={e=>setForm(f=>({...f,actionTaken:e.target.value}))} rows={2} placeholder={"What was done immediately? e.g. Child separated, first aid given, parent called."} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
        </Fld>
        <Fld label="Witnesses (optional)"><Inp value={form.witnesses} onChange={v=>setForm(f=>({...f,witnesses:v}))} placeholder="Names of staff or children who witnessed"/></Fld>
        {/* Severity indicator */}
        {form.severity&&(()=>{const s=INCIDENT_SEVERITIES.find(x=>x.key===form.severity);return s?<div style={{background:s.bg,border:"1px solid "+s.color+"55",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,color:s.color,fontWeight:500}}>{form.severity==="Critical"?"🚨 CRITICAL — Notify senior leadership immediately and document in writing.":form.severity==="High"?"⚠ HIGH — Parent must be contacted today. Keep full written record.":form.severity==="Medium"?"📋 MEDIUM — Parent notification recommended. Monitor child.":"✓ LOW — Document for records. Follow up if pattern develops."}</div>:null;})()}
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={submit} v="danger" style={{flex:1,justifyContent:"center"}}>Submit Incident Report</Btn>
          <Btn onClick={()=>setModal(false)} v="ghost" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        </div>
      </Modal>

      {/* Edit / detail modal */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title="Edit Incident Report" width={520}>
        {detail&&(()=>{
          const ch=children.find(c=>c.id===detail.childId);
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:BG,borderRadius:10,border:"0.5px solid "+BR,marginBottom:14}}>
                <Av f={ch?.first||"?"} l={ch?.last||""} sz={36}/>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:N}}>{ch?ch.first+" "+ch.last:"Unknown"}</div>
                  <div style={{fontSize:11,color:MU}}>{fd(detail.date)} · {detail.type}</div>
                </div>
                <span style={{marginLeft:"auto",...INCIDENT_SEVERITIES.find(s=>s.key===detail.severity)?{color:INCIDENT_SEVERITIES.find(s=>s.key===detail.severity)!.color,background:INCIDENT_SEVERITIES.find(s=>s.key===detail.severity)!.bg,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}:{}}}>{detail.severity}</span>
              </div>
              <Fld label="Status">
                <div style={{display:"flex",gap:8}}>
                  {INCIDENT_STATUSES.map(s=><button key={s} onClick={()=>{updateStatus(detail.id,s);setDetail({...detail,status:s});}} style={{flex:1,padding:"8px 6px",borderRadius:8,border:"1.5px solid "+(detail.status===s?N:BR),background:detail.status===s?N:W,color:detail.status===s?"#fff":TX,fontSize:12,cursor:"pointer",fontWeight:detail.status===s?500:400}}>{s}</button>)}
                </div>
              </Fld>
              <Fld label="Description">
                <textarea defaultValue={detail.description} onBlur={e=>setIncidents(r=>r.map(i=>i.id===detail.id?{...i,description:e.target.value}:i))} rows={4} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
              </Fld>
              <Fld label="Action Taken">
                <textarea defaultValue={detail.actionTaken||""} onBlur={e=>setIncidents(r=>r.map(i=>i.id===detail.id?{...i,actionTaken:e.target.value}:i))} rows={2} style={{width:"100%",padding:"10px 12px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.7}}/>
              </Fld>
              <div style={{display:"flex",gap:8,marginTop:6}}>
                <Btn onClick={()=>contactParent(detail)} v="gold" style={{flex:1,justifyContent:"center"}}>Contact Parent</Btn>
                <Btn onClick={()=>setDetail(null)} v="success" style={{flex:1,justifyContent:"center"}}>Done</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function Education({members,visitors,users,roles,children,setChildren,classrooms,setClassrooms,teacherSchedule,setTeacherSchedule,kidsCheckIns,setKidsCheckIns,checkIns,incidents,setIncidents,rollCalls,setRollCalls,progressNotes,setProgressNotes,cs}:any){
  const [tab,setTab]=useState("dashboard");
  const today=td();
  const todayCI=(kidsCheckIns as any[]).filter((c:any)=>c.date===today);
  const openIncidents=(incidents as any[]).filter((i:any)=>i.status!=="Resolved").length;
  const TABS=[{id:"dashboard",label:"Overview"},{id:"checkin",label:"Check-In"},{id:"rollcall",label:"Roll Call"},{id:"children",label:"Children"},{id:"progress",label:"Progress"},{id:"classrooms",label:"Classrooms"},{id:"teachers",label:"Teachers"},{id:"incidents",label:"Incidents"},{id:"reports",label:"Reports"}];
  return(
    <div>
      <div style={{display:"flex",marginBottom:20,background:W,borderRadius:10,border:"0.5px solid "+BR,overflow:"hidden",flexWrap:"wrap"}}>
        {TABS.map((t:any)=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:72,padding:"10px 4px",border:"none",borderBottom:"2px solid "+(tab===t.id?G:"transparent"),background:tab===t.id?"#f8f9fc":W,fontSize:11,fontWeight:tab===t.id?500:400,color:tab===t.id?N:MU,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
          {t.label}
          {t.id==="checkin"&&todayCI.length>0&&<span style={{background:GR,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px"}}>{todayCI.length}</span>}
          {t.id==="incidents"&&openIncidents>0&&<span style={{background:RE,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px"}}>{openIncidents}</span>}
        </button>)}
      </div>
      {tab==="dashboard"&&<EdDashboard classrooms={classrooms} children={children} kidsCheckIns={kidsCheckIns} teacherSchedule={teacherSchedule} users={users} members={members} checkIns={checkIns} setTab={setTab}/>}
      {tab==="checkin"&&<CheckInPortal classrooms={classrooms} children={children} setChildren={setChildren} kidsCheckIns={kidsCheckIns} setKidsCheckIns={setKidsCheckIns} members={members}/>}
      {tab==="rollcall"&&<ClassRollCall classrooms={classrooms} children={children} rollCalls={rollCalls} setRollCalls={setRollCalls} teacherSchedule={teacherSchedule} users={users} members={members} cs={cs}/>}
      {tab==="children"&&<ChildrenRoster children={children} setChildren={setChildren} classrooms={classrooms} members={members} kidsCheckIns={kidsCheckIns} incidents={incidents}/>}
      {tab==="progress"&&<ChildProgress children={children} classrooms={classrooms} rollCalls={rollCalls} progressNotes={progressNotes} setProgressNotes={setProgressNotes} cs={cs}/>}
      {tab==="classrooms"&&<ClassroomsManager classrooms={classrooms} setClassrooms={setClassrooms} teacherSchedule={teacherSchedule} users={users} members={members} kidsCheckIns={kidsCheckIns}/>}
      {tab==="teachers"&&<TeacherScheduleMgr classrooms={classrooms} teacherSchedule={teacherSchedule} setTeacherSchedule={setTeacherSchedule} users={users} members={members} roles={roles}/>}
      {tab==="incidents"&&<IncidentReports incidents={incidents} setIncidents={setIncidents} children={children} classrooms={classrooms} members={members} cs={cs}/>}
      {tab==="reports"&&<EdReports classrooms={classrooms} children={children} kidsCheckIns={kidsCheckIns} teacherSchedule={teacherSchedule} users={users} members={members} rollCalls={rollCalls}/>}
    </div>
  );
}

// ── ADD PERSON PAGE ──
// Central intake form — the one place everyone enters the database.
// Gated by Access Control: requires directory → create permission.
const ALLERGY_OPTIONS=["Peanuts","Tree Nuts","Milk/Dairy","Eggs","Wheat/Gluten","Soy","Fish","Shellfish","Latex","Bee Stings","Penicillin","Aspirin","Ibuprofen","Sulfa Drugs"];
const MEDICAL_OPTIONS=["Diabetes","High Blood Pressure","Heart Condition","Asthma","Epilepsy/Seizures","Mobility Impairment","Vision Impairment","Hearing Impairment","Cancer","Kidney Disease","Thyroid Disorder","Depression/Anxiety","PTSD","Autism Spectrum"];

function AddMemberPage({members,setMembers,visitors,setVisitors,currentUser,roles,permissions,setView}:any){
  const canAdd = checkPermission(currentUser,roles,permissions,"directory","create");
  const addedByName = (()=>{
    if(!currentUser) return "Unknown";
    if(currentUser.memberId){
      const m=[...members,...(visitors||[])].find((p:any)=>p.id===currentUser.memberId);
      if(m) return m.first+" "+m.last;
    }
    return currentUser.email||"Staff";
  })();

  // Build unique city/zip lists from all existing records
  const allPeople = [...(members||[]),...(visitors||[])];
  const knownCities = Array.from(new Set(allPeople.map((p:any)=>p.address?.city).filter(Boolean))).sort() as string[];
  const knownZips   = Array.from(new Set(allPeople.map((p:any)=>p.address?.zip).filter(Boolean))).sort() as string[];

  const [pType,setPType] = useState<"member"|"visitor">("member");
  const blankForm=()=>({
    first:"",last:"",phone:"",email:"",
    // Member fields
    status:"Active",role:"",joined:td(),family:"",
    // Visitor fields
    stage:"First Visit",sponsor:"",firstVisit:td(),
    // Address
    address:{street:"",city:"",state:"AZ",zip:""},
    // Personal
    birthday:"",anniversary:"",spouseName:"",
    children:[] as any[],
    // Emergency
    emergencyName:"",emergencyPhone:"",emergencyRelation:"",
    // Faith
    salvationDate:"",baptismDate:"",
    // Medical
    allergies:[] as string[],medical:[] as string[],medicalNotes:"",
    // Work
    occupation:"",employer:"",
    // Notes
    notes:""
  });
  const [form,setForm] = useState(blankForm());
  const [saved,setSaved] = useState<any>(null);
  const [dupWarning,setDupWarning] = useState<any>(null);
  const nid = useRef(Date.now());

  const sf=(k:string)=>(v:any)=>setForm((f:any)=>({...f,[k]:v}));
  const sfa=(k:string)=>(v:any)=>setForm((f:any)=>({...f,address:{...f.address,[k]:v}}));
  const toggleArr=(field:string,item:string)=>setForm((f:any)=>{
    const arr:string[]=f[field]||[];
    return {...f,[field]:arr.includes(item)?arr.filter((x:string)=>x!==item):[...arr,item]};
  });
  const addChild=()=>setForm((f:any)=>({...f,children:[...f.children,{name:"",birthday:""}]}));
  const updChild=(i:number,k:string,v:string)=>setForm((f:any)=>({...f,children:f.children.map((c:any,idx:number)=>idx===i?{...c,[k]:v}:c)}));
  const remChild=(i:number)=>setForm((f:any)=>({...f,children:f.children.filter((_:any,idx:number)=>idx!==i)}));

  const checkDups=()=>{
    const fn=(form.first||"").trim().toLowerCase();
    const ln=(form.last||"").trim().toLowerCase();
    const ph=(form.phone||"").replace(/\D/g,"");
    const all=[...members,...visitors];
    return all.filter((p:any)=>{
      const nameMatch=(p.first||"").trim().toLowerCase()===fn&&(p.last||"").trim().toLowerCase()===ln&&fn&&ln;
      const phoneMatch=ph&&(p.phone||"").replace(/\D/g,"")===ph;
      return nameMatch||phoneMatch;
    });
  };

  const doSave=()=>{
    const id=nid.current++;
    const record={...form,id,addedBy:addedByName,addedDate:td()};
    if(pType==="member"){
      setMembers((ms:any[])=>[{...record,type:"Member"},...ms]);
    } else {
      setVisitors((vs:any[])=>[{...record,type:"Visitor"},...vs]);
    }
    setSaved({name:form.first+" "+form.last,type:pType});
    setForm(blankForm());
    setDupWarning(null);
  };

  const handleSave=()=>{
    if(!form.first||!form.last){alert("First and last name are required.");return;}
    const dups=checkDups();
    if(dups.length>0){
      setDupWarning(dups);
    } else {
      doSave();
    }
  };

  // Section heading helper
  const SH=({label,icon}:{label:string,icon:string})=>(
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"22px 0 12px",paddingBottom:6,borderBottom:"1.5px solid "+G+"44"}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:13,fontWeight:600,color:N,textTransform:"uppercase",letterSpacing:0.6}}>{label}</span>
    </div>
  );
  const ToggleChip=({label,active,onClick}:{label:string,active:boolean,onClick:()=>void})=>(
    <button onClick={onClick} style={{padding:"4px 10px",borderRadius:20,border:"1px solid "+(active?N:BR),background:active?N:"transparent",color:active?"#fff":TX,fontSize:12,cursor:"pointer",fontWeight:active?500:400}}>{label}</button>
  );

  if(!canAdd){
    return(
      <div style={{maxWidth:600,margin:"60px auto",textAlign:"center",padding:32}}>
        <div style={{fontSize:48,marginBottom:16}}>🔒</div>
        <h2 style={{fontSize:20,fontWeight:500,color:N,marginBottom:8}}>Access Restricted</h2>
        <p style={{fontSize:13,color:MU,marginBottom:24}}>Your current role does not have permission to add people to the database. Contact your administrator to request access.</p>
        <Btn onClick={()=>setView("people")} v="outline">← Go to Members</Btn>
      </div>
    );
  }

  if(saved){
    return(
      <div style={{maxWidth:520,margin:"60px auto",textAlign:"center",padding:32}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"#e8f5e9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>✓</div>
        <h2 style={{fontSize:20,fontWeight:500,color:GR,marginBottom:6}}>{saved.name} added!</h2>
        <p style={{fontSize:13,color:MU,marginBottom:24}}>{saved.name} has been added to the database as a {saved.type}.</p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn onClick={()=>setSaved(null)} v="gold">+ Add Another Person</Btn>
          <Btn onClick={()=>setView("people")} v="outline">Go to {saved.type==="member"?"Members":"Visitation"} →</Btn>
          {saved.type==="visitor"&&<Btn onClick={()=>setView("visitation")} v="outline">Go to Visitation →</Btn>}
        </div>
      </div>
    );
  }

  return(
    <div style={{maxWidth:800,margin:"0 auto"}}>
      {/* Page Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:500,color:N,margin:0}}>Add Person to Database</h2>
          <div style={{fontSize:12,color:MU,marginTop:2}}>This is the central intake form. All new members and visitors start here.</div>
        </div>
        <div style={{fontSize:11,color:MU,background:BG,border:"0.5px solid "+BR,borderRadius:8,padding:"6px 12px"}}>
          Added by: <strong style={{color:N}}>{addedByName}</strong>
        </div>
      </div>

      {/* Duplicate warning */}
      {dupWarning&&(
        <div style={{background:"#fff8e1",border:"1.5px solid "+AM,borderRadius:10,padding:16,marginBottom:20}}>
          <div style={{fontWeight:600,color:"#7a4200",fontSize:14,marginBottom:8}}>⚠ Possible Duplicate Found</div>
          <div style={{fontSize:13,color:"#7a4200",marginBottom:10}}>The following {dupWarning.length===1?"person":"people"} already exist with the same name or phone number:</div>
          {dupWarning.map((p:any)=>(
            <div key={p.id} style={{background:W,border:"0.5px solid "+AM+"88",borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <strong style={{color:N}}>{p.first} {p.last}</strong>
                <span style={{fontSize:11,color:MU,marginLeft:8}}>{p.phone||""} {p.email||""}</span>
              </div>
              <span style={{fontSize:11,background:BG,borderRadius:6,padding:"2px 8px",color:MU}}>{p.type||p.stage||"Member"}</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <Btn onClick={doSave} v="gold" style={{fontSize:12}}>Save Anyway (New Record)</Btn>
            <Btn onClick={()=>setDupWarning(null)} v="ghost" style={{fontSize:12}}>Cancel — Go Back to Edit</Btn>
          </div>
        </div>
      )}

      <div style={{background:W,border:"0.5px solid "+BR,borderRadius:14,padding:24}}>
        {/* Type Switcher */}
        <div style={{display:"flex",gap:0,background:BG,borderRadius:10,padding:4,marginBottom:20,width:"fit-content",border:"0.5px solid "+BR}}>
          <button onClick={()=>setPType("member")} style={{padding:"8px 24px",borderRadius:8,border:"none",background:pType==="member"?N:"transparent",color:pType==="member"?"#fff":MU,fontSize:13,fontWeight:pType==="member"?500:400,cursor:"pointer"}}>Church Member</button>
          <button onClick={()=>setPType("visitor")} style={{padding:"8px 24px",borderRadius:8,border:"none",background:pType==="visitor"?G:"transparent",color:pType==="visitor"?"#fff":MU,fontSize:13,fontWeight:pType==="visitor"?500:400,cursor:"pointer"}}>Visitor / Guest</button>
        </div>

        {/* ── SECTION 1: Basic Info ── */}
        <SH label="Basic Information" icon="👤"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
          <Fld label="First Name *"><Inp value={form.first} onChange={sf("first")} placeholder="First name"/></Fld>
          <Fld label="Last Name *"><Inp value={form.last} onChange={sf("last")} placeholder="Last name"/></Fld>
          <Fld label="Phone"><Inp value={form.phone} onChange={sf("phone")} placeholder="(602) 555-0100"/></Fld>
          <Fld label="Email"><Inp value={form.email} onChange={sf("email")} placeholder="email@example.com"/></Fld>
        </div>
        <Fld label="Family / Household"><Inp value={form.family} onChange={sf("family")} placeholder="e.g. Smith Household"/></Fld>

        {/* ── SECTION 2: Member or Visitor Status ── */}
        {pType==="member"?(
          <>
            <SH label="Membership Details" icon="⛪"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Fld label="Status"><Slt value={form.status} onChange={sf("status")} opts={["Active","Inactive","New Member","On Leave","Transferred"]}/></Fld>
              <Fld label="Role / Ministry"><Inp value={form.role} onChange={sf("role")} placeholder="Deacon, Choir, Usher…"/></Fld>
              <Fld label="Join Date"><Inp type="date" value={form.joined} onChange={sf("joined")}/></Fld>
            </div>
          </>
        ):(
          <>
            <SH label="Visitor Details" icon="🤝"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Fld label="Stage"><Slt value={form.stage} onChange={sf("stage")} opts={["First Visit","Follow-Up Needed","Returning","Prospect","Member"]}/></Fld>
              <Fld label="Sponsor / Greeter"><Inp value={form.sponsor} onChange={sf("sponsor")} placeholder="Who brought them?"/></Fld>
              <Fld label="First Visit Date"><Inp type="date" value={form.firstVisit} onChange={sf("firstVisit")}/></Fld>
            </div>
          </>
        )}

        {/* ── SECTION 3: Address ── */}
        <SH label="Address" icon="📍"/>
        <Fld label="Street Address"><Inp value={form.address.street} onChange={sfa("street")} placeholder="123 Main St"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>
          <Fld label="City">
            <input
              list="addr-city-list"
              value={form.address.city}
              onChange={e=>sfa("city")(e.target.value)}
              placeholder="Phoenix"
              style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box" as any,background:W}}
            />
            <datalist id="addr-city-list">
              {knownCities.map((c:string)=><option key={c} value={c}/>)}
            </datalist>
          </Fld>
          <Fld label="State"><Inp value={form.address.state} onChange={sfa("state")} placeholder="AZ"/></Fld>
          <Fld label="ZIP">
            <input
              list="addr-zip-list"
              value={form.address.zip}
              onChange={e=>sfa("zip")(e.target.value)}
              placeholder="85001"
              style={{width:"100%",padding:"8px 10px",border:"0.5px solid "+BR,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box" as any,background:W}}
            />
            <datalist id="addr-zip-list">
              {knownZips.map((z:string)=><option key={z} value={z}/>)}
            </datalist>
          </Fld>
        </div>

        {/* ── SECTION 4: Personal ── */}
        <SH label="Personal Information" icon="🎂"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Birthday"><Inp type="date" value={form.birthday} onChange={sf("birthday")}/></Fld>
          <Fld label="Anniversary"><Inp type="date" value={form.anniversary} onChange={sf("anniversary")}/></Fld>
          <Fld label="Spouse Name"><Inp value={form.spouseName} onChange={sf("spouseName")} placeholder="Spouse's full name"/></Fld>
        </div>
        {/* Children */}
        <div style={{marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:500,color:N}}>Children</span>
            <Btn onClick={addChild} v="outline" style={{fontSize:11,padding:"3px 10px"}}>+ Add Child</Btn>
          </div>
          {form.children.map((c:any,i:number)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
              <Fld label={`Child ${i+1} Name`}><Inp value={c.name} onChange={v=>updChild(i,"name",v)} placeholder="Full name"/></Fld>
              <Fld label="Birthday"><Inp type="date" value={c.birthday} onChange={v=>updChild(i,"birthday",v)}/></Fld>
              <button onClick={()=>remChild(i)} style={{height:34,marginBottom:2,border:"none",background:"transparent",cursor:"pointer",color:RE,fontSize:18,padding:"0 6px"}}>×</button>
            </div>
          ))}
          {form.children.length===0&&<div style={{fontSize:11,color:MU,fontStyle:"italic"}}>No children added yet.</div>}
        </div>

        {/* ── SECTION 5: Emergency Contact ── */}
        <SH label="Emergency Contact" icon="🚨"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fld label="Contact Name"><Inp value={form.emergencyName} onChange={sf("emergencyName")} placeholder="Full name"/></Fld>
          <Fld label="Contact Phone"><Inp value={form.emergencyPhone} onChange={sf("emergencyPhone")} placeholder="(602) 555-…"/></Fld>
          <Fld label="Relationship"><Inp value={form.emergencyRelation} onChange={sf("emergencyRelation")} placeholder="Spouse, Parent…"/></Fld>
        </div>

        {/* ── SECTION 6: Faith Journey ── */}
        <SH label="Faith Journey" icon="✝"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Salvation Date"><Inp type="date" value={form.salvationDate} onChange={sf("salvationDate")}/></Fld>
          <Fld label="Baptism Date"><Inp type="date" value={form.baptismDate} onChange={sf("baptismDate")}/></Fld>
        </div>

        {/* ── SECTION 7: Medical & Allergies ── */}
        <SH label="Medical & Allergies" icon="🏥"/>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:MU,fontWeight:500,marginBottom:6}}>Allergies (select all that apply)</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {ALLERGY_OPTIONS.map(a=>(
              <ToggleChip key={a} label={a} active={form.allergies.includes(a)} onClick={()=>toggleArr("allergies",a)}/>
            ))}
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:MU,fontWeight:500,marginBottom:6}}>Medical Conditions</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {MEDICAL_OPTIONS.map(m=>(
              <ToggleChip key={m} label={m} active={form.medical.includes(m)} onClick={()=>toggleArr("medical",m)}/>
            ))}
          </div>
        </div>
        <Fld label="Medical Notes"><textarea value={form.medicalNotes} onChange={e=>sf("medicalNotes")(e.target.value)} rows={2} placeholder="Any additional medical information…" style={{width:"100%",padding:"8px 10px",border:"1px solid "+BR,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box" as any}}/></Fld>

        {/* ── SECTION 8: Occupation ── */}
        <SH label="Occupation" icon="💼"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Occupation / Job Title"><Inp value={form.occupation} onChange={sf("occupation")} placeholder="Teacher, Engineer…"/></Fld>
          <Fld label="Employer"><Inp value={form.employer} onChange={sf("employer")} placeholder="Company / Organization"/></Fld>
        </div>

        {/* ── SECTION 9: Notes ── */}
        <SH label="Notes" icon="📝"/>
        <Fld label="General Notes"><textarea value={form.notes} onChange={e=>sf("notes")(e.target.value)} rows={3} placeholder="Any pastoral notes, special needs, or context…" style={{width:"100%",padding:"8px 10px",border:"1px solid "+BR,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box" as any}}/></Fld>

        {/* Save Row */}
        <div style={{display:"flex",gap:10,marginTop:24,paddingTop:16,borderTop:"0.5px solid "+BR,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <Btn onClick={()=>setForm(blankForm())} v="ghost">Clear Form</Btn>
          <Btn onClick={handleSave} style={{minWidth:160,justifyContent:"center"}}>Save {pType==="member"?"Member":"Visitor"} to Database</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function App({churchId,churchName,adminFirst,adminLast,onSignOut}:any={}) {
  const _I = window.__NTCC_INIT__ || {};
  // Namespace localStorage by churchId so each church's data is isolated
  const LS = (key:string) => churchId ? `ntcc_${churchId}_${key}` : `ntcc_${key}`;
  const lsGet = (key:string) => { try { const r=localStorage.getItem(LS(key)); return r?JSON.parse(r):null; } catch(e){ return null; } };
  const lsSave = (key:string, val:any) => { try { localStorage.setItem(LS(key),JSON.stringify(val)); } catch(e){} };

  // ── Cloud sync state ──
  const [cloudSync,setCloudSync] = useState<'idle'|'loading'|'saving'|'saved'|'error'>('idle');
  const sbSyncTimer = useRef<any>(null);
  const [isMobile,setIsMobile] = useState(window.innerWidth<768);
  const [navOpen,setNavOpen] = useState(false);
  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return()=>window.removeEventListener("resize",fn);
  },[]);
  const [churchSettings,setChurchSettings] = useState(_I.churchSettings || DEFAULT_CS);
  const [showSetup,setShowSetup] = useState(false);
  const [view,setView] = useState("dashboard");
  const [members,setMembers] = useState(lsGet('members') ?? _I.members ?? []);
  const [visitors,setVisitors] = useState(lsGet('visitors') ?? _I.visitors ?? []);
  const [attendance,setAttendance] = useState(lsGet('attendance') ?? _I.attendance ?? []);
  const [giving,setGiving] = useState(lsGet('giving') ?? _I.giving ?? []);
  const [prayers,setPrayers] = useState(lsGet('prayers') ?? _I.prayers ?? []);
  const [aiChat,setAiChat] = useState([]);
  const [users,setUsers] = useState([{id:1,memberId:5,roleId:"role_admin",password:"pastor2026",pin:"1234",status:"Active",superAdmin:true,overrides:{}}]);
  const [roles,setRoles] = useState(()=>{
    const saved = lsGet('roles');
    if(!saved || saved.length===0) return SEED_ROLES;
    // Merge any new SEED_ROLES not already in saved list
    const savedIds = new Set(saved.map((r:any)=>r.id));
    const newOnes = SEED_ROLES.filter(r=>!savedIds.has(r.id));
    return [...saved, ...newOnes];
  });
  const [permissions,setPermissions] = useState(()=>{
    const saved = lsGet('permissions');
    const base = saved || SEED_PERMS;
    // Ensure any new roles have entries
    const result = {...base};
    SEED_ROLES.forEach(r=>{ if(!result[r.id]) result[r.id]=makeEmptyPerms(); });
    return result;
  });
  const currentUser = users.find(u=>u.superAdmin) || users[0];
  window.__CS__ = churchSettings;
  useEffect(()=>{
    try{
      const _raw=localStorage.getItem(LS('church_settings'));
      if(_raw){
        const parsed=JSON.parse(_raw);
        // Pre-fill church name from registration if not yet set
        if(churchName&&(!parsed.name||parsed.name===DEFAULT_CS.name)){parsed.name=churchName;}
        setChurchSettings(parsed);
      } else {
        if(churchName){setChurchSettings((s:any)=>({...s,name:churchName}));}
        if(!window.__NTCC_INIT__?.churchSettings){setShowSetup(true);}
      }
    }catch(e){if(!window.__NTCC_INIT__?.churchSettings){setShowSetup(true);}}
  },[]);
  useEffect(()=>{
    if(!churchSettings.name) return;
    try{localStorage.setItem(LS('church_settings'),JSON.stringify(churchSettings));}catch(e){}
  },[JSON.stringify(churchSettings)]);
  const [portalMembers,setPortalMembers] = useState([]);
  const [groups,setGroups] = useState(lsGet('groups') ?? _I.groups ?? []);
  const [grpMeetings,setGrpMeetings] = useState(lsGet('grpMeetings') ?? _I.grpMeetings ?? []);
  const [recurring,setRecurring] = useState(lsGet('recurring') ?? INIT_RECURRING);
  const [custom,setCustom] = useState(lsGet('custom') ?? []);
  const [checkIns,setCheckIns] = useState(lsGet('checkIns') ?? []);
  const _storedCL=lsGet('classrooms')||_I.classrooms;const _hasOldCL=_storedCL&&(_storedCL.length>7||_storedCL.some((c:any)=>["","1st","2nd","3rd","4th","5th","6th","7th"].includes(c.grade)));
  const [classrooms,setClassrooms] = useState(_hasOldCL?ICLASSROOMS:(_storedCL||ICLASSROOMS));
  const _storedKids=lsGet('children')||_I.children;const _migratedKids=_storedKids?_storedKids.map((c:any)=>({...c,grade:CHURCH_LEVELS.find((l:any)=>l.name===c.grade)?c.grade:levelFromAge(typeof calcAge(c.dob)==="number"?calcAge(c.dob) as number:6)})):[];
  const [children,setChildren] = useState(_migratedKids);
  const [teacherSchedule,setTeacherSchedule] = useState(lsGet('teacherSchedule') ?? []);
  const [kidsCheckIns,setKidsCheckIns] = useState(lsGet('kidsCheckIns') ?? []);
  const [incidents,setIncidents] = useState(lsGet('incidents') ?? _I.incidents ?? []);
  const [rollCalls,setRollCalls] = useState(lsGet('rollCalls') ?? _I.rollCalls ?? []);
  const [progressNotes,setProgressNotes] = useState(lsGet('progressNotes') ?? _I.progressNotes ?? []);
  const [equipment,setEquipment] = useState(lsGet('equipment') ?? window.__NTCC_INIT__?.equipment ?? []);
  const [workOrders,setWorkOrders] = useState(lsGet('workOrders') ?? window.__NTCC_INIT__?.workOrders ?? []);
  const [schedMaint,setSchedMaint] = useState(lsGet('schedMaint') ?? window.__NTCC_INIT__?.schedMaint ?? []);
  const [pledgeDrives,setPledgeDrives] = useState(lsGet('pledgeDrives') ?? _I.pledgeDrives ?? []);
  const [pledges,setPledges] = useState(lsGet('pledges') ?? _I.pledges ?? []);
  const [weeklyReports,setWeeklyReports] = useState(lsGet('weeklyReports') ?? _I.weeklyReports ?? []);
  const [visitRecords,setVisitRecords] = useState(lsGet('visitRecords') ?? []);

  // Email system state
  const [emailLog,setEmailLog] = useState(lsGet('emailLog') ?? _I.emailLog ?? []);
  const [emailTemplates,setEmailTemplates] = useState(lsGet('emailTemplates') ?? _I.emailTemplates ?? DEFAULT_EMAIL_TEMPLATES);
  const [emailConfig,setEmailConfig] = useState(lsGet('emailConfig') ?? _I.emailConfig ?? {provider:"",apiKey:"",fromEmail:"",fromName:""});
  const [composerOpen,setComposerOpen] = useState(false);
  const [composerProps,setComposerProps] = useState({});
  const [bulkComposerOpen,setBulkComposerOpen] = useState(false);
  const [bulkComposerProps,setBulkComposerProps] = useState({});

  // ── Auto-save all data to localStorage on every change ──
  useEffect(()=>{lsSave('members',members);},[JSON.stringify(members)]);
  useEffect(()=>{lsSave('visitors',visitors);},[JSON.stringify(visitors)]);
  useEffect(()=>{lsSave('attendance',attendance);},[JSON.stringify(attendance)]);
  useEffect(()=>{lsSave('giving',giving);},[JSON.stringify(giving)]);
  useEffect(()=>{lsSave('prayers',prayers);},[JSON.stringify(prayers)]);
  useEffect(()=>{lsSave('groups',groups);},[JSON.stringify(groups)]);
  useEffect(()=>{lsSave('grpMeetings',grpMeetings);},[JSON.stringify(grpMeetings)]);
  useEffect(()=>{lsSave('visitRecords',visitRecords);},[JSON.stringify(visitRecords)]);
  useEffect(()=>{lsSave('children',children);},[JSON.stringify(children)]);
  useEffect(()=>{lsSave('classrooms',classrooms);},[JSON.stringify(classrooms)]);
  useEffect(()=>{lsSave('equipment',equipment);},[JSON.stringify(equipment)]);
  useEffect(()=>{lsSave('workOrders',workOrders);},[JSON.stringify(workOrders)]);
  useEffect(()=>{lsSave('schedMaint',schedMaint);},[JSON.stringify(schedMaint)]);
  useEffect(()=>{lsSave('pledgeDrives',pledgeDrives);},[JSON.stringify(pledgeDrives)]);
  useEffect(()=>{lsSave('pledges',pledges);},[JSON.stringify(pledges)]);
  useEffect(()=>{lsSave('weeklyReports',weeklyReports);},[JSON.stringify(weeklyReports)]);
  useEffect(()=>{lsSave('emailLog',emailLog);},[JSON.stringify(emailLog)]);
  useEffect(()=>{lsSave('emailTemplates',emailTemplates);},[JSON.stringify(emailTemplates)]);
  useEffect(()=>{lsSave('emailConfig',emailConfig);},[JSON.stringify(emailConfig)]);
  useEffect(()=>{lsSave('recurring',recurring);},[JSON.stringify(recurring)]);
  useEffect(()=>{lsSave('custom',custom);},[JSON.stringify(custom)]);
  useEffect(()=>{lsSave('checkIns',checkIns);},[JSON.stringify(checkIns)]);
  useEffect(()=>{lsSave('incidents',incidents);},[JSON.stringify(incidents)]);
  useEffect(()=>{lsSave('rollCalls',rollCalls);},[JSON.stringify(rollCalls)]);
  useEffect(()=>{lsSave('progressNotes',progressNotes);},[JSON.stringify(progressNotes)]);
  useEffect(()=>{lsSave('teacherSchedule',teacherSchedule);},[JSON.stringify(teacherSchedule)]);
  useEffect(()=>{lsSave('kidsCheckIns',kidsCheckIns);},[JSON.stringify(kidsCheckIns)]);
  useEffect(()=>{lsSave('roles',roles);},[JSON.stringify(roles)]);
  useEffect(()=>{lsSave('permissions',permissions);},[JSON.stringify(permissions)]);

  // ── Load from Supabase on mount — cloud is source of truth across devices ──
  useEffect(()=>{
    if(!churchId) return;
    setCloudSync('loading');
    (async()=>{
      const {data:row,error} = await supabase.from('church_data').select('data').eq('church_id',churchId).maybeSingle();
      setCloudSync('idle');
      if(error||!row?.data) return;
      const d = row.data;
      if(Array.isArray(d.members)&&d.members.length) setMembers(d.members);
      if(Array.isArray(d.visitors)&&d.visitors.length) setVisitors(d.visitors);
      if(Array.isArray(d.attendance)&&d.attendance.length) setAttendance(d.attendance);
      if(Array.isArray(d.giving)&&d.giving.length) setGiving(d.giving);
      if(Array.isArray(d.prayers)&&d.prayers.length) setPrayers(d.prayers);
      if(Array.isArray(d.groups)&&d.groups.length) setGroups(d.groups);
      if(Array.isArray(d.grpMeetings)&&d.grpMeetings.length) setGrpMeetings(d.grpMeetings);
      if(Array.isArray(d.visitRecords)&&d.visitRecords.length) setVisitRecords(d.visitRecords);
      if(Array.isArray(d.children)&&d.children.length) setChildren(d.children);
      if(Array.isArray(d.classrooms)&&d.classrooms.length) setClassrooms(d.classrooms);
      if(Array.isArray(d.equipment)&&d.equipment.length) setEquipment(d.equipment);
      if(Array.isArray(d.workOrders)&&d.workOrders.length) setWorkOrders(d.workOrders);
      if(Array.isArray(d.schedMaint)&&d.schedMaint.length) setSchedMaint(d.schedMaint);
      if(Array.isArray(d.pledgeDrives)&&d.pledgeDrives.length) setPledgeDrives(d.pledgeDrives);
      if(Array.isArray(d.pledges)&&d.pledges.length) setPledges(d.pledges);
      if(Array.isArray(d.weeklyReports)&&d.weeklyReports.length) setWeeklyReports(d.weeklyReports);
      if(Array.isArray(d.emailLog)&&d.emailLog.length) setEmailLog(d.emailLog);
      if(d.emailTemplates) setEmailTemplates(d.emailTemplates);
      if(d.emailConfig?.provider!==undefined) setEmailConfig(d.emailConfig);
      if(Array.isArray(d.recurring)&&d.recurring.length) setRecurring(d.recurring);
      if(Array.isArray(d.custom)&&d.custom.length) setCustom(d.custom);
      if(Array.isArray(d.checkIns)&&d.checkIns.length) setCheckIns(d.checkIns);
      if(Array.isArray(d.incidents)&&d.incidents.length) setIncidents(d.incidents);
      if(Array.isArray(d.rollCalls)&&d.rollCalls.length) setRollCalls(d.rollCalls);
      if(Array.isArray(d.progressNotes)&&d.progressNotes.length) setProgressNotes(d.progressNotes);
      if(Array.isArray(d.teacherSchedule)&&d.teacherSchedule.length) setTeacherSchedule(d.teacherSchedule);
      if(Array.isArray(d.kidsCheckIns)&&d.kidsCheckIns.length) setKidsCheckIns(d.kidsCheckIns);
      if(Array.isArray(d.roles)&&d.roles.length) setRoles(d.roles);
      if(d.permissions&&Object.keys(d.permissions).length) setPermissions(d.permissions);
      if(d.churchSettings?.name){setChurchSettings(d.churchSettings);try{localStorage.setItem(LS('church_settings'),JSON.stringify(d.churchSettings));}catch(e){}}
    })();
  },[churchId]);

  // ── Debounced Supabase cloud-save (3 s after last change) ──
  useEffect(()=>{
    if(!churchId) return;
    if(sbSyncTimer.current) clearTimeout(sbSyncTimer.current);
    setCloudSync('saving');
    sbSyncTimer.current = setTimeout(async()=>{
      const blob = {members,visitors,attendance,giving,prayers,groups,grpMeetings,visitRecords,
        children,classrooms,equipment,workOrders,schedMaint,pledgeDrives,pledges,weeklyReports,
        emailLog,emailTemplates,emailConfig,recurring,custom,checkIns,incidents,rollCalls,
        progressNotes,teacherSchedule,kidsCheckIns,roles,permissions,churchSettings};
      const {error} = await supabase.from('church_data').upsert(
        {church_id:churchId,data:blob,updated_at:new Date().toISOString()},
        {onConflict:'church_id'}
      );
      setCloudSync(error?'error':'saved');
      setTimeout(()=>setCloudSync('idle'),2500);
    },3000);
  },[JSON.stringify({members,visitors,attendance,giving,prayers,groups,grpMeetings,visitRecords,
    children,classrooms,equipment,workOrders,schedMaint,pledgeDrives,pledges,weeklyReports,
    emailLog,emailTemplates,emailConfig,recurring,custom,checkIns,incidents,rollCalls,
    progressNotes,teacherSchedule,kidsCheckIns,roles,permissions,churchSettings})]);

  const nidEmail = useRef(8000);
  const logEmail = (data) => {
    const entry = {
      id: nidEmail.current++,
      timestamp: new Date().toISOString(),
      to: data.to || "",
      toName: data.toName || "",
      cc: data.cc || "",
      bcc: data.bcc || "",
      subject: data.subject,
      body: data.body,
      category: data.category,
      htmlMode: data.htmlMode,
      method: data.method,
      status: data.status,
      isBulk: !!data.recipients,
      recipientCount: data.recipients ? data.recipients.length : 0,
      recipientList: data.recipients ? data.recipients.map(r=>r.name||r.email).join(", ") : "",
      relatedType: data.relatedType || "",
      relatedId: data.relatedId || null,
    };
    setEmailLog(l => [entry, ...l]);
  };

  // Expose email composer globally so child components can open it
  const openEmailComposer = (props = {}) => {
    setComposerProps(props);
    setComposerOpen(true);
  };
  const openBulkEmailComposer = (props = {}) => {
    setBulkComposerProps(props);
    setBulkComposerOpen(true);
  };
  window.__openEmailComposer__ = openEmailComposer;
  window.__openBulkEmailComposer__ = openBulkEmailComposer;

  // SMS system state
  const [smsLog,setSmsLog] = useState(_I.smsLog || []);
  const [smsTemplates,setSmsTemplates] = useState(_I.smsTemplates || DEFAULT_SMS_TEMPLATES);
  const [smsConfig,setSmsConfig] = useState(_I.smsConfig || {accountSid:"",authToken:"",fromPhone:""});
  const [smsComposerOpen,setSmsComposerOpen] = useState(false);
  const [smsComposerProps,setSmsComposerProps] = useState({});
  const [bulkSmsComposerOpen,setBulkSmsComposerOpen] = useState(false);
  const [bulkSmsComposerProps,setBulkSmsComposerProps] = useState({});
  const nidSms = useRef(9000);
  const logSms = (data) => {
    const entry = { id: nidSms.current++, timestamp: new Date().toISOString(), to: data.to||"", toName: data.toName||"", body: data.body, category: data.category, method: data.method, status: data.status, isBulk: !!data.recipients, recipientCount: data.recipients?data.recipients.length:0, relatedType: data.relatedType||"", relatedId: data.relatedId||null };
    setSmsLog(l => [entry, ...l]);
  };
  const openSmsComposer = (props = {}) => { setSmsComposerProps(props); setSmsComposerOpen(true); };
  const openBulkSmsComposer = (props = {}) => { setBulkSmsComposerProps(props); setBulkSmsComposerOpen(true); };
  window.__openSmsComposer__ = openSmsComposer;
  window.__openBulkSmsComposer__ = openBulkSmsComposer;

  const NAV = [
    {id:"dashboard",label:"Dashboard",icon:"D"},
    {id:"addperson",label:"Add Person",icon:"➕"},
    {id:"people",label:"Members Profile",icon:"P"},
    {id:"visitation",label:"Visitation",icon:"V"},
    {id:"groups",label:"Groups Ministry",icon:"G2"},
    {id:"education",label:"Education",icon:"Ed"},
    {id:"maintenance",label:"Maintenance",icon:"Mnt"},
    {id:"calendar",label:"Event Calendar",icon:"Cal"},
    {id:"attendance",label:"Attendance",icon:"A"},
    {id:"giving",label:"Giving",icon:"$"},
    {id:"prayer",label:"Prayer Wall",icon:"Pr"},
    {id:"email",label:"Email Center",icon:"@"},
    {id:"sms",label:"SMS Center",icon:"✉"},
    {id:"access",label:"Access Control",icon:"Ac"},
    {id:"ai",label:"AI Assistant",icon:"AI"},
    {id:"settings",label:"Settings",icon:"⚙"},
  ];
  const TITLES = {dashboard:"Dashboard",addperson:"Add Person to Database",people:"Members Profile",visitation:"Visitation & Follow-Up",education:"Education Department",maintenance:"Maintenance & Equipment",attendance:"Attendance",giving:"Giving Records",prayer:"Prayer Wall",email:"Email Center",sms:"SMS Center",access:"Access Control",ai:"AI Assistant",settings:"Church Settings"};
  const pending = users.filter(u=>u.status==="Pending").length;
  const fu = visitors.filter(v=>v.stage==="Follow-Up Needed").length;
  const inVis = visitRecords.filter(r=>r.stage!=="Complete").length;
  const maintAlerts = computeMaintAlerts(equipment, schedMaint);
  const maintAlertCount = maintAlerts.overdue.length + maintAlerts.urgent.length + maintAlerts.warrantyExpired.length + maintAlerts.warrantyExpiringSoon.length;

  const logoInitials=(churchSettings.name||"AI").split(" ").filter(w=>w).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const LogoEl=()=>churchSettings.logoUrl
    ?<img src={churchSettings.logoUrl} style={{width:36,height:36,borderRadius:8,objectFit:"cover",flexShrink:0,border:"1px solid #ffffff33"}} alt="logo" onError={e=>e.target.style.display="none"}/>
    :<div style={{width:36,height:36,borderRadius:8,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{logoInitials}</div>;

  const NavContent=()=>(
    <>
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid #ffffff18"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <LogoEl/>
          <div style={{minWidth:0}}>
            <div style={{color:"#fff",fontWeight:500,fontSize:13,lineHeight:1.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{churchSettings.name}</div>
            <div style={{color:"#7a9acc",fontSize:11}}>Church Database v5</div>
          </div>
        </div>
      </div>
      <div style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {NAV.map(item=>(
          <button key={item.id} onClick={()=>{setView(item.id);setNavOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 12px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:2,background:view===item.id?"#ffffff18":"transparent",color:view===item.id?"#fff":"#7a9acc",fontWeight:view===item.id?500:400,fontSize:13,textAlign:"left"}}>
            <span style={{fontSize:13,minWidth:18}}>{item.icon}</span>
            {item.label}
            {item.id==="ai"&&<span style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:G,flexShrink:0}}></span>}
            {item.id==="people"&&fu>0&&<span style={{marginLeft:"auto",background:RE,color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px"}}>{fu}</span>}
            {item.id==="access"&&pending>0&&<span style={{marginLeft:"auto",background:AM,color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px"}}>{pending}</span>}
            {item.id==="visitation"&&inVis>0&&<span style={{marginLeft:"auto",background:PU,color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px"}}>{inVis}</span>}
            {item.id==="maintenance"&&maintAlertCount>0&&<span style={{marginLeft:"auto",background:RE,color:"#fff",borderRadius:10,fontSize:10,fontWeight:600,padding:"1px 6px"}}>{maintAlertCount}</span>}
          </button>
        ))}
      </div>
      <div style={{padding:"12px 14px",borderTop:"1px solid #ffffff18"}}>
        <div style={{color:"#7a9acc",fontSize:11,marginBottom:3}}>Signed in as</div>
        <div style={{color:"#fff",fontSize:12,fontWeight:500}}>{churchSettings.pastorName}</div>
        <div style={{color:G,fontSize:11}}>Super Administrator</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80"}}></div>
          <span style={{fontSize:11,color:"#7a9acc"}}>ElevenLabs AI Online</span>
        </div>
      </div>
    </>
  );

  return (
    <div style={{display:"flex",height:"100vh",background:BG,fontFamily:"system-ui,sans-serif",fontSize:14,color:TX,overflow:"hidden"}}>

      {/* Mobile drawer overlay */}
      {isMobile && navOpen && (
        <div onClick={()=>setNavOpen(false)} style={{position:"fixed",inset:0,background:"#00000066",zIndex:200}}>
          <div onClick={e=>e.stopPropagation()} style={{width:260,height:"100%",background:N,display:"flex",flexDirection:"column",overflowY:"auto"}}>
            <NavContent/>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{width:220,background:N,display:"flex",flexDirection:"column",flexShrink:0}}>
          <NavContent/>
        </div>
      )}

      {/* Main content */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",minWidth:0}}>

        {/* Header */}
        <div style={{background:W,borderBottom:"1px solid "+BR,padding:isMobile?"10px 14px":"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            {isMobile && (
              <button onClick={()=>setNavOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:N,fontSize:22,lineHeight:1,flexShrink:0}}>☰</button>
            )}
            <div style={{minWidth:0}}>
              <h1 style={{fontSize:isMobile?15:17,fontWeight:500,color:N,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{TITLES[view]}</h1>
              {!isMobile && <p style={{fontSize:12,color:MU,margin:0}}>{churchSettings.name}{churchSettings.address?" — "+churchSettings.address:""}</p>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {!isMobile && <div style={{fontSize:12,fontWeight:500}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>}
            {cloudSync==='loading' && <div style={{fontSize:11,color:MU,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:MU,display:"inline-block",animation:"pulse 1s infinite"}}></span>Loading…</div>}
            {cloudSync==='saving' && <div style={{fontSize:11,color:AM,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:AM,display:"inline-block"}}></span>Saving…</div>}
            {cloudSync==='saved' && <div style={{fontSize:11,color:GR,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:GR,display:"inline-block"}}></span>Saved ✓</div>}
            {cloudSync==='error' && <div style={{fontSize:11,color:RE,display:"flex",alignItems:"center",gap:4}}>⚠ Sync error</div>}
            <button onClick={()=>{setView("ai");setNavOpen(false);}} style={{background:GL,border:"1px solid "+G,borderRadius:8,padding:isMobile?"7px 10px":"7px 12px",cursor:"pointer",fontSize:12,fontWeight:500,color:"#7a5c10",whiteSpace:"nowrap"}}>AI</button>
            <button onClick={()=>{setView("settings");setNavOpen(false);}} style={{background:N+"12",border:"0.5px solid "+N+"33",borderRadius:8,padding:isMobile?"7px 10px":"7px 12px",cursor:"pointer",fontSize:12,fontWeight:500,color:N}}>⚙</button>
            {onSignOut&&<button onClick={onSignOut} title="Sign Out" style={{background:"#fee2e2",border:"0.5px solid #fca5a5",borderRadius:8,padding:isMobile?"7px 10px":"7px 12px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#dc2626",whiteSpace:"nowrap"}}>Sign Out</button>}
          </div>
        </div>

        {/* Page content */}
        <div style={{flex:1,padding:isMobile?12:24,overflow:"auto"}}>
          {showSetup && <SetupModal onSave={s=>{setChurchSettings(s);setShowSetup(false);}}/>}
          {view==="settings" && <ChurchSettingsPage cs={churchSettings} setCs={setChurchSettings} members={members} setMembers={setMembers} visitors={visitors} attendance={attendance} giving={giving} prayers={prayers} groups={groups} grpMeetings={grpMeetings} visitRecords={visitRecords} checkIns={checkIns} kidsCheckIns={kidsCheckIns} children={children} pledgeDrives={pledgeDrives} pledges={pledges} weeklyReports={weeklyReports} equipment={equipment} workOrders={workOrders} schedMaint={schedMaint}/>}
          {view==="dashboard" && <Dashboard members={members} visitors={visitors} attendance={attendance} giving={giving} prayers={prayers} setView={setView}/>}
          {view==="addperson" && <AddMemberPage members={members} setMembers={setMembers} visitors={visitors} setVisitors={setVisitors} currentUser={currentUser} roles={roles} permissions={permissions} setView={setView}/>}
          {view==="people" && <People members={members} setMembers={setMembers} visitors={visitors} setVisitors={setVisitors} attendance={attendance} giving={giving} prayers={prayers} groups={groups} grpMeetings={grpMeetings} visitRecords={visitRecords} setVisitRecords={setVisitRecords} checkIns={checkIns} setView={setView}/>}
          {view==="groups" && <Groups members={members} groups={groups} setGroups={setGroups} grpMeetings={grpMeetings} setGrpMeetings={setGrpMeetings}/>}
          {view==="education" && <Education members={members} visitors={visitors} users={users} roles={roles} children={children} setChildren={setChildren} classrooms={classrooms} setClassrooms={setClassrooms} teacherSchedule={teacherSchedule} setTeacherSchedule={setTeacherSchedule} kidsCheckIns={kidsCheckIns} setKidsCheckIns={setKidsCheckIns} checkIns={checkIns} incidents={incidents} setIncidents={setIncidents} rollCalls={rollCalls} setRollCalls={setRollCalls} progressNotes={progressNotes} setProgressNotes={setProgressNotes} cs={churchSettings}/>}
          {view==="maintenance" && <Maintenance users={users} members={members} currentUser={currentUser} roles={roles} permissions={permissions} equipment={equipment} setEquipment={setEquipment} workOrders={workOrders} setWorkOrders={setWorkOrders} schedMaint={schedMaint} setSchedMaint={setSchedMaint}/>}
          {view==="calendar" && (
            <div style={{height:"calc(100vh - 110px)",display:"flex",flexDirection:"column",margin:-24,overflow:"hidden"}}>
              <CalendarView
                members={members}
                visitors={visitors}
                setVisitors={setVisitors}
                groups={groups}
                recurring={recurring}
                setRecurring={setRecurring}
                custom={custom}
                setCustom={setCustom}
                checkIns={checkIns}
                setCheckIns={setCheckIns}
                grpMeetings={grpMeetings}
                setGrpMeetings={setGrpMeetings}
              />
            </div>
          )}
          {view==="visitation" && <Visitation visitors={visitors} setVisitors={setVisitors} members={members} setMembers={setMembers} users={users} visitRecords={visitRecords} setVisitRecords={setVisitRecords} setView={setView}/>}
          {view==="attendance" && <Attendance attendance={attendance} setAttendance={setAttendance} setView={setView}/>}
          {view==="giving" && <Giving giving={giving} setGiving={setGiving} pledgeDrives={pledgeDrives} setPledgeDrives={setPledgeDrives} pledges={pledges} setPledges={setPledges} members={members} visitors={visitors} weeklyReports={weeklyReports} setWeeklyReports={setWeeklyReports} emailTemplates={emailTemplates}/>}
          {view==="prayer" && <Prayer prayers={prayers} setPrayers={setPrayers}/>}
          {view==="sms" && <SmsCenter smsLog={smsLog} setSmsLog={setSmsLog} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} smsConfig={smsConfig} setSmsConfig={setSmsConfig} members={members} visitors={visitors} cs={churchSettings} onCompose={()=>openSmsComposer({})} onBulkCompose={()=>openBulkSmsComposer({recipients:[...members,...visitors].filter(p=>p.phone).map(p=>({...p,first:p.first,last:p.last,name:p.first+" "+p.last}))})}/>}
          {view==="email" && <EmailCenter emailLog={emailLog} setEmailLog={setEmailLog} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} emailConfig={emailConfig} setEmailConfig={setEmailConfig} members={members} visitors={visitors} cs={churchSettings} onCompose={()=>openEmailComposer({})} onBulkCompose={()=>openBulkEmailComposer({recipients:members.filter(m=>m.email).map(m=>({name:m.first+" "+m.last,first:m.first,last:m.last,email:m.email}))})}/>}
          {view==="access" && <Access members={members} users={users} setUsers={setUsers} roles={roles} setRoles={setRoles} permissions={permissions} setPermissions={setPermissions} portalMembers={portalMembers} setPortalMembers={setPortalMembers} currentUser={currentUser}/>}
          {view==="ai" && <AIAssist aiChat={aiChat} setAiChat={setAiChat} members={members} setMembers={setMembers} visitors={visitors} setVisitors={setVisitors} attendance={attendance} setAttendance={setAttendance} giving={giving} setGiving={setGiving} prayers={prayers} setView={setView} isMobile={isMobile}/>}
        </div>
      </div>

      {/* Global Email Composers — accessible from any page */}
      <EmailComposer
        open={composerOpen}
        onClose={()=>setComposerOpen(false)}
        initialTo={composerProps.to}
        initialToName={composerProps.toName}
        initialSubject={composerProps.subject}
        initialBody={composerProps.body}
        initialCategory={composerProps.category}
        relatedType={composerProps.relatedType}
        relatedId={composerProps.relatedId}
        cs={churchSettings}
        templates={emailTemplates}
        onSend={logEmail}
        emailConfig={emailConfig}
      />
      <BulkEmailComposer
        open={bulkComposerOpen}
        onClose={()=>setBulkComposerOpen(false)}
        recipients={bulkComposerProps.recipients||[]}
        initialSubject={bulkComposerProps.subject}
        initialBody={bulkComposerProps.body}
        initialCategory={bulkComposerProps.category}
        relatedType={bulkComposerProps.relatedType}
        cs={churchSettings}
        templates={emailTemplates}
        onSend={logEmail}
        emailConfig={emailConfig}
      />
      <SmsComposer
        open={smsComposerOpen}
        onClose={()=>setSmsComposerOpen(false)}
        initialPhone={smsComposerProps.phone}
        initialName={smsComposerProps.name}
        initialBody={smsComposerProps.body}
        initialCategory={smsComposerProps.category}
        relatedType={smsComposerProps.relatedType}
        relatedId={smsComposerProps.relatedId}
        cs={churchSettings}
        templates={smsTemplates}
        onSend={logSms}
        members={members}
        visitors={visitors}
      />
      <BulkSmsComposer
        open={bulkSmsComposerOpen}
        onClose={()=>setBulkSmsComposerOpen(false)}
        recipients={bulkSmsComposerProps.recipients||[]}
        initialBody={bulkSmsComposerProps.body}
        initialCategory={bulkSmsComposerProps.category}
        relatedType={bulkSmsComposerProps.relatedType}
        cs={churchSettings}
        templates={smsTemplates}
        onSend={logSms}
        members={members}
        visitors={visitors}
      />
    </div>
  );
}