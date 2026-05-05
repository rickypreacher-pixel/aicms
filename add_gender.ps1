$fp = "C:\Users\Admin\OneDrive\Desktop\ntcc-church-app-2026\src\App.tsx"
$fc = [IO.File]::ReadAllText($fp, [Text.Encoding]::UTF8)
$origLen = $fc.Length
Write-Output "START len=$origLen"

# ── CHANGE 1: Add gender:"Male" to AddMemberPage addChild init ──
$old1 = '{first:"",last:"",birthday:"",grade:"",memberId:null as any}'
$new1 = '{first:"",last:"",birthday:"",grade:"",gender:"Male",memberId:null as any}'
$fc2 = $fc.Replace($old1, $new1)
Write-Output "C1 addChild gender field: $($fc2.Length -ne $fc.Length) (changed=$($fc2 -ne $fc))"
$fc = $fc2

# ── CHANGE 2a: Remove the old Gender <Slt> dropdown that was added by previous subagent ──
# It was inserted with a backtick-r-backtick-n before it
$genderSltOld = '`r`n          <Fld label="Gender"><Slt value={form.gender} onChange={sf("gender")} opts={["Male","Female"]}/></Fld>'
$fc2 = $fc.Replace($genderSltOld, '')
Write-Output "C2a remove old gender slt (backtick-r-n): $($fc2 -ne $fc)"
if ($fc2 -eq $fc) {
    # Try without the backtick sequence
    $genderSltOld2 = '<Fld label="Gender"><Slt value={form.gender} onChange={sf("gender")} opts={["Male","Female"]}/></Fld>'
    $fc2 = $fc.Replace($genderSltOld2, '')
    Write-Output "C2a (fallback, no prefix): $($fc2 -ne $fc)"
}
$fc = $fc2

# ── CHANGE 2b: Add gender radio buttons after the 2-col grid (before Family/Household) ──
$old2 = '        <Fld label="Family / Household"><Inp value={form.family} onChange={sf("family")} placeholder="e.g. Smith Household"/></Fld>'
$new2 = @'
        <Fld label="Gender *">
          <div style={{display:"flex",gap:24,alignItems:"center",paddingTop:4}}>
            {(["Male","Female"] as string[]).map(opt=>(
              <label key={opt} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:TX}}>
                <input type="radio" name="add-gender" value={opt} checked={form.gender===opt} onChange={()=>sf("gender")(opt)} style={{cursor:"pointer",accentColor:N,width:15,height:15}}/>
                {opt}
              </label>
            ))}
          </div>
        </Fld>
        <Fld label="Family / Household"><Inp value={form.family} onChange={sf("family")} placeholder="e.g. Smith Household"/></Fld>
'@
$new2 = $new2.TrimEnd()
$fc2 = $fc.Replace($old2, $new2)
Write-Output "C2b add gender radios (AddPerson): $($fc2 -ne $fc)"
$fc = $fc2

# ── CHANGE 3: Add gender radios to child rows in AddMemberPage ──
# Insert after <Fld label="Grade Level">...</Fld> in the children map (AddMemberPage)
# The unique anchor is the Grade Level followed by the linked badge / remove button pattern in AddMemberPage
$old3 = '              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Fld label="Birthday"><Inp type="date" value={c.birthday||""} onChange={v=>{updChild(i,"birthday",v);const ag=calcAge(v);if(typeof ag==="number"&&ag>=0)updChild(i,"grade",gradeFromAge(ag));}}/></Fld>
                <Fld label="Grade Level"><Slt value={c.grade||""} onChange={v=>updChild(i,"grade",v)} opts={["", ...CHILD_GRADES]}/></Fld>
              </div>
              {c.memberId&&'
$new3 = @'
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Fld label="Birthday"><Inp type="date" value={c.birthday||""} onChange={v=>{updChild(i,"birthday",v);const ag=calcAge(v);if(typeof ag==="number"&&ag>=0)updChild(i,"grade",gradeFromAge(ag));}}/></Fld>
                <Fld label="Grade Level"><Slt value={c.grade||""} onChange={v=>updChild(i,"grade",v)} opts={["", ...CHILD_GRADES]}/></Fld>
              </div>
              <Fld label="Gender *">
                <div style={{display:"flex",gap:20,alignItems:"center",paddingTop:4}}>
                  {(["Male","Female"] as string[]).map(opt=>(
                    <label key={opt} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:TX}}>
                      <input type="radio" name={"child-g-"+String(i)} value={opt} checked={(c.gender||"Male")===opt} onChange={()=>updChild(i,"gender",opt)} style={{cursor:"pointer",accentColor:N,width:15,height:15}}/>
                      {opt}
                    </label>
                  ))}
                </div>
              </Fld>
              {c.memberId&&
'@
$new3 = $new3.TrimEnd()
$fc2 = $fc.Replace($old3, $new3)
Write-Output "C3 child gender radios (AddPerson): $($fc2 -ne $fc)"
$fc = $fc2

# ── CHANGE 4: Add gender radios to Edit Profile Basic Information (People component) ──
$old4 = '                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Phone"><Inp value={editForm.phone||""} onChange={ef("phone")}/></Fld>
                    <Fld label="Email"><Inp value={editForm.email||""} onChange={ef("email")}/></Fld>
                  </div>
                  {detail._type==="members" ? ('
$new4 = @'
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Fld label="Phone"><Inp value={editForm.phone||""} onChange={ef("phone")}/></Fld>
                    <Fld label="Email"><Inp value={editForm.email||""} onChange={ef("email")}/></Fld>
                  </div>
                  <Fld label="Gender *">
                    <div style={{display:"flex",gap:24,alignItems:"center",paddingTop:4}}>
                      {(["Male","Female"] as string[]).map(opt=>(
                        <label key={opt} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:TX}}>
                          <input type="radio" name="edit-gender" value={opt} checked={(editForm.gender||"Male")===opt} onChange={()=>ef("gender")(opt)} style={{cursor:"pointer",accentColor:N,width:15,height:15}}/>
                          {opt}
                        </label>
                      ))}
                    </div>
                  </Fld>
                  {detail._type==="members" ? (
'@
$new4 = $new4.TrimEnd()
$fc2 = $fc.Replace($old4, $new4)
Write-Output "C4 gender radios (EditProfile): $($fc2 -ne $fc)"
$fc = $fc2

# ── CHANGE 5: Add gender radios to child rows in People edit mode ──
$old5 = '                        <Fld label="Birthday"><Inp type="date" value={c.birthday||""} onChange={(v:string)=>{updChild(i,"birthday",v);const ag=calcAge(v);if(typeof ag==="number"&&ag>=0)updChild(i,"grade",gradeFromAge(ag));}}/></Fld>
                        <Fld label="Grade Level"><Slt value={c.grade||""} onChange={(v:string)=>updChild(i,"grade",v)} opts={["", ...CHILD_GRADES]}/></Fld>
                        {(childSug[i]||[]).length>0 && ('
$new5 = @'
                        <Fld label="Birthday"><Inp type="date" value={c.birthday||""} onChange={(v:string)=>{updChild(i,"birthday",v);const ag=calcAge(v);if(typeof ag==="number"&&ag>=0)updChild(i,"grade",gradeFromAge(ag));}}/></Fld>
                        <Fld label="Grade Level"><Slt value={c.grade||""} onChange={(v:string)=>updChild(i,"grade",v)} opts={["", ...CHILD_GRADES]}/></Fld>
                        <Fld label="Gender *">
                          <div style={{display:"flex",gap:20,alignItems:"center",paddingTop:4}}>
                            {(["Male","Female"] as string[]).map(opt=>(
                              <label key={opt} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:TX}}>
                                <input type="radio" name={"eg-"+String(i)} value={opt} checked={(c.gender||"Male")===opt} onChange={()=>updChild(i,"gender",opt)} style={{cursor:"pointer",accentColor:N,width:15,height:15}}/>
                                {opt}
                              </label>
                            ))}
                          </div>
                        </Fld>
                        {(childSug[i]||[]).length>0 && (
'@
$new5 = $new5.TrimEnd()
$fc2 = $fc.Replace($old5, $new5)
Write-Output "C5 child gender radios (EditProfile): $($fc2 -ne $fc)"
$fc = $fc2

Write-Output "FINAL len=$($fc.Length) (delta=$($fc.Length - $origLen))"

# Write file
[IO.File]::WriteAllText($fp, $fc, [Text.Encoding]::UTF8)
Write-Output "FILE WRITTEN OK"
