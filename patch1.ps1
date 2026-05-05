$fp = "C:\Users\Admin\OneDrive\Desktop\ntcc-church-app-2026\src\App.tsx"
$src = [IO.File]::ReadAllText($fp, [Text.Encoding]::UTF8)
$orig = $src

# CHANGE 1: CalendarView signature
$old1 = 'function CalendarView({members,visitors,setVisitors,groups,recurring,setRecurring,custom,setCustom,checkIns,setCheckIns,grpMeetings=[],setGrpMeetings=()=>{},prospects=[],setProspects=()=>{}})'
$new1 = 'function CalendarView({members,visitors,setVisitors,groups,recurring,setRecurring,custom,setCustom,checkIns,setCheckIns,grpMeetings=[],setGrpMeetings=()=>{},prospects=[],setProspects=()=>{},servicePlans={},setServicePlans=()=>{}})'
if($src.Contains($old1)){$src=$src.Replace($old1,$new1);Write-Host "C1 OK"}else{Write-Host "C1 NOT FOUND"}

# CHANGE 2: evtDetailTab state + planner helpers
$old2 = 'const [evtForm,setEvtForm]=useState({name:"",type:"Worship",time:"11:00 AM",location:"",color:N,recurring:true,dow:0,date:td()});'
$ins2 = "`n  const [evtDetailTab,setEvtDetailTab]=useState(`"checkin`");`n  useEffect(()=>{setEvtDetailTab(`"checkin`");},[selEvt?.iid]);`n  const PLANNER_SERVICES=[`"Sunday Morning Worship`",`"Sunday Night Service`",`"Tuesday Bible Study`",`"Thursday Worship`"];`n  const planKey=selEvt?selEvt.name+`"|`"+selEvt.date:`"`";`n  const plan=(servicePlans||{})[planKey]||{songs:[{title:`"`",key:`"`",leader:`"`"}],announcements:[`"`"],sermonTitle:`"`",sermonScripture:`"`",sermonSpeaker:`"`"};`n  const setPlan=(p:any)=>setServicePlans((sp:any)=>({...sp,[planKey]:p}));`n  const addSong=()=>setPlan({...plan,songs:[...plan.songs,{title:`"`",key:`"`",leader:`"`"}]});`n  const remSong=(si:number)=>setPlan({...plan,songs:plan.songs.filter((_:any,j:number)=>j!==si)});`n  const setSong=(si:number,field:string,val:string)=>setPlan({...plan,songs:plan.songs.map((s:any,j:number)=>j===si?{...s,[field]:val}:s)});`n  const addAnn=()=>setPlan({...plan,announcements:[...plan.announcements,`"`"]});`n  const remAnn=(ai:number)=>setPlan({...plan,announcements:plan.announcements.filter((_:any,j:number)=>j!==ai)});`n  const setAnn=(ai:number,val:string)=>setPlan({...plan,announcements:plan.announcements.map((a:any,j:number)=>j===ai?val:a)});`n  const setSermon=(field:string,val:string)=>setPlan({...plan,[field]:val});"
$new2 = $old2 + $ins2
if($src.Contains($old2)){$src=$src.Replace($old2,$new2);Write-Host "C2 OK"}else{Write-Host "C2 NOT FOUND"}

# CHANGE 4: servicePlans state in App
$old4 = "const [custom,setCustom] = useState(lsGet('custom') ?? []);"
$new4 = "const [custom,setCustom] = useState(lsGet('custom') ?? []);`n  const [servicePlans,setServicePlans] = useState(lsGet('servicePlans') ?? {});"
if($src.Contains($old4)){$src=$src.Replace($old4,$new4);Write-Host "C4 OK"}else{Write-Host "C4 NOT FOUND"}

# CHANGE 5: auto-save
$old5 = "useEffect(()=>{lsSave('recurring',recurring);},[JSON.stringify(recurring)]);"
$new5 = "useEffect(()=>{lsSave('recurring',recurring);},[JSON.stringify(recurring)]);`n  useEffect(()=>{lsSave('servicePlans',servicePlans);},[JSON.stringify(servicePlans)]);"
if($src.Contains($old5)){$src=$src.Replace($old5,$new5);Write-Host "C5 OK"}else{Write-Host "C5 NOT FOUND"}

# CHANGE 6: pass props to CalendarView
$old6 = "                prospects={prospects}`n                setProspects={setProspects}`n              />"
$new6 = "                prospects={prospects}`n                setProspects={setProspects}`n                servicePlans={servicePlans}`n                setServicePlans={setServicePlans}`n              />"
if($src.Contains($old6)){$src=$src.Replace($old6,$new6);Write-Host "C6 OK"}else{Write-Host "C6 NOT FOUND"}

if($src -ne $orig){
  [IO.File]::WriteAllText($fp, $src, [Text.Encoding]::UTF8)
  Write-Host "Saved"
} else {
  Write-Host "No changes"
}
