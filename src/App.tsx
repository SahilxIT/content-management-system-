import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { 
  Activity, Bell, CalendarDays, Check, ChevronDown, CirclePlus, Clock3, FileText,
  FolderKanban, LayoutDashboard, Library, Menu, Moon, MoreHorizontal, Play,
  Search, Settings, Sparkles, Sun, TrendingDown, TrendingUp, Users, Video, AlertTriangle, Copy,
  X, Zap, Trash2, ArrowLeft, Plug,
  Globe2, Music2, Upload, CreditCard, ChevronLeft, ChevronRight,
  Database, BookOpen, Link2, ShieldCheck, KeyRound, RefreshCw, ExternalLink,
} from 'lucide-react'

import { supabase } from './supabase'
import { QRCodeSVG } from 'qrcode.react'

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'


type Range = 'Today' | '7 days' | '30 days' | 'Quarter' | 'Year'
type Page = 'Overview' | 'Team' | 'Projects' | 'Connection' | 'Calendar' | 'Plugins' | 'APIs' | 'Video analytics' | 'Engine' | 'Reports' | 'Database' | 'Notifications' | 'Settings'
type Project = { id: number; name: string; client: string; owner: string; type: string; deadline: string; priority: string; description: string; progress: number }
type ShareLink = { inviteId: string; url: string; createdAt: string; maxUses: number|null }
type Notice = { id: number; title: string; detail: string; time: string; kind: 'urgent' | 'approval' | 'performance' | 'assignment'; read: boolean }
type WorkTask = { id: number; title: string; done: boolean; requiresUpload?: boolean; fileName?: string }
type Worker = { id: number; projectId?: number; name: string; role: string; info: string; initials: string; tasks: number; done: number; status: string; color: string; stage: string; due: string; workTasks: WorkTask[] }
type AnalyticsData = { mediaName: string; contentType: string; views: number; likes: number; comments: number; shares: number }
type SocialMetric = { id:number; projectId:number; platform:string; account:string; contentType:string; title:string; mediaName:string; reach:number; views:number; likes:number; comments:number; shares:number; saves:number }
type WorkspaceReport = { id:number; title:string; author:string; body:string; createdAt:string }
type DatabaseDraft = { id:number; name:string; provider:string; status:'Draft'|'Setup required' }
type ProjectShareSnapshot = { project:Project; workers:Worker[]; socialMetrics:SocialMetric[]; analytics:AnalyticsData|null; reports:WorkspaceReport[]; apiConnections:string[] }

function makeProjectShareSnapshot(project:Project,workers:Worker[],socialMetrics:SocialMetric[],analytics:Record<number,AnalyticsData>,reports:WorkspaceReport[],apiConnections:Record<number,string[]>):ProjectShareSnapshot {
  return {
    project:{...project,id:0},
    workers:workers.filter(worker=>worker.projectId===project.id).map(worker=>({...worker,projectId:0})),
    socialMetrics:socialMetrics.filter(metric=>metric.projectId===project.id).map(metric=>({...metric,projectId:0})),
    analytics:analytics[project.id]||null,
    reports,
    apiConnections:apiConnections[project.id]||[],
  }
}

const trendData: Record<Range, { day: string; produced: number; published: number }[]> = {
  Today: [{ day: '8am', produced: 1, published: 0 }, { day: '10am', produced: 3, published: 1 }, { day: '12pm', produced: 4, published: 2 }, { day: '2pm', produced: 7, published: 3 }, { day: '4pm', produced: 9, published: 5 }],
  '7 days': [{ day: 'Mon', produced: 10, published: 5 }, { day: 'Tue', produced: 15, published: 8 }, { day: 'Wed', produced: 13, published: 9 }, { day: 'Thu', produced: 22, published: 12 }, { day: 'Fri', produced: 20, published: 14 }, { day: 'Sat', produced: 25, published: 16 }, { day: 'Sun', produced: 29, published: 19 }],
  '30 days': [{ day: 'Week 1', produced: 42, published: 28 }, { day: 'Week 2', produced: 58, published: 34 }, { day: 'Week 3', produced: 51, published: 40 }, { day: 'Week 4', produced: 72, published: 48 }],
  Quarter: [{ day: 'Jan', produced: 142, published: 96 }, { day: 'Feb', produced: 167, published: 112 }, { day: 'Mar', produced: 193, published: 138 }],
  Year: [{ day: 'Q1', produced: 410, published: 286 }, { day: 'Q2', produced: 522, published: 341 }, { day: 'Q3', produced: 604, published: 418 }, { day: 'Q4', produced: 712, published: 501 }],
}

const taskSet = (role: string): WorkTask[] => {
  const byRole: Record<string, string[]> = {
    'Content Creator': ['Confirm content angle', 'Record primary footage', 'Review final content'],
    'Content Researcher': ['Research audience questions', 'Collect trusted sources', 'Submit research brief'],
    'Script Writer': ['Create first draft', 'Refine hook and CTA', 'Submit approved script'],
    'Videographer': ['Prepare camera setup', 'Complete production shoot', 'Upload organized footage'],
    'Video Editor': ['Create rough cut', 'Add captions and graphics', 'Export final master'],
    'Thumbnail Creator': ['Create thumbnail concepts', 'Upload final thumbnail', 'Confirm thumbnail approval'],
    'YouTube SEO Specialist': ['Research search keywords', 'Optimize title and description', 'Add tags and publish checklist'],
  }
  return (byRole[role] || ['Review assignment brief', 'Complete assigned work', 'Submit for review']).map((title,index)=>({ id: Date.now()+Math.random()+index, title, done: false, requiresUpload: role==='Thumbnail Creator'&&index===1 }))
}
const makeWorker = (id: number, name: string, role: string, info: string, color: string): Worker => {
  const due = new Date(); due.setDate(due.getDate()+7)
  const workTasks = taskSet(role)
  return { id, name, role, info, initials: name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase(), tasks: workTasks.length, done: 0, status: 'Available', color, stage: 'Idea', due: due.toISOString().slice(0,10), workTasks }
}
const initialTeam: Worker[] = []
const demoTeam: Worker[] = [
  makeWorker(901,'Maya Chen','Content Creator','Demo member · Short-form production','violet'),
  makeWorker(902,'Noah Williams','Video Editor','Demo member · Editing and delivery','blue'),
  makeWorker(903,'Ava Kapoor','Script Writer','Demo member · Scripts and storytelling','orange'),
].map((worker,index)=>{
  const workTasks=worker.workTasks.map((task,taskIndex)=>({...task,done:index<2||taskIndex<2}))
  return {...worker,workTasks,done:workTasks.filter(task=>task.done).length,stage:index<2?'Approved':'In progress'}
})
const demoSocialMetrics: SocialMetric[] = [
  {id:801,projectId:0,platform:'Instagram',account:'@flowcast.demo',contentType:'Reel / Short',title:'Creator workflow reel',mediaName:'creator-reel.mp4',reach:1280000,views:940000,likes:112000,comments:8400,shares:26000,saves:38000},
  {id:802,projectId:0,platform:'YouTube',account:'Flowcast Demo',contentType:'Video',title:'Production system walkthrough',mediaName:'workflow-video.mp4',reach:860000,views:620000,likes:74000,comments:6100,shares:14000,saves:9000},
  {id:803,projectId:0,platform:'TikTok',account:'@flowcast.demo',contentType:'Reel / Short',title:'Three-second hook',mediaName:'hook-short.mp4',reach:740000,views:580000,likes:89000,comments:7200,shares:19000,saves:21000},
]

const content = [
  { title: 'Creator economy in 60 seconds', type: 'Reel', stage: 'Editing', owner: 'Noah Williams', due: 'Today', priority: 'High', progress: 68 },
  { title: 'Behind the scenes: Studio day', type: 'Short', stage: 'Review', owner: 'Maya Chen', due: 'Tomorrow', priority: 'Medium', progress: 84 },
  { title: 'Q2 product launch story', type: 'Video', stage: 'Shooting', owner: 'Amara Okafor', due: 'May 28', priority: 'High', progress: 42 },
  { title: '5 workflow tips for creators', type: 'Reel', stage: 'Scheduled', owner: 'Leo Martins', due: 'May 30', priority: 'Low', progress: 96 },
]

const videos = [
  { title: 'How we plan 30 days of content', platform: 'Instagram', views: '482K', engagement: '12.8%', status: 'Trending', score: 92 },
  { title: 'The 3-second hook framework', platform: 'YouTube', views: '218K', engagement: '9.4%', status: 'Trending', score: 78 },
  { title: 'A day inside our studio', platform: 'TikTok', views: '94K', engagement: '6.2%', status: 'Average', score: 56 },
  { title: 'Weekly creator roundup', platform: 'Instagram', views: '18K', engagement: '2.1%', status: 'Low', score: 25 },
]

const initialProjects: Project[] = []

const randomShareToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('')
const sha256Fallback=(input:string)=>{
  const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const bytes=new TextEncoder().encode(input)
  const paddedLength=Math.ceil((bytes.length+9)/64)*64
  const padded=new Uint8Array(paddedLength)
  padded.set(bytes);padded[bytes.length]=0x80
  const view=new DataView(padded.buffer)
  view.setUint32(paddedLength-8,Math.floor(bytes.length*8/0x100000000),false)
  view.setUint32(paddedLength-4,(bytes.length*8)>>>0,false)
  const state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
  const words=new Uint32Array(64)
  const rotate=(value:number,count:number)=>(value>>>count)|(value<<(32-count))
  for(let offset=0;offset<paddedLength;offset+=64){
    for(let index=0;index<16;index++)words[index]=view.getUint32(offset+index*4,false)
    for(let index=16;index<64;index++){
      const a=words[index-15],b=words[index-2]
      const small0=rotate(a,7)^rotate(a,18)^(a>>>3)
      const small1=rotate(b,17)^rotate(b,19)^(b>>>10)
      words[index]=(words[index-16]+small0+words[index-7]+small1)>>>0
    }
    let [a,b,c,d,e,f,g,h]=state
    for(let index=0;index<64;index++){
      const big1=rotate(e,6)^rotate(e,11)^rotate(e,25)
      const choose=(e&f)^(~e&g)
      const temp1=(h+big1+choose+constants[index]+words[index])>>>0
      const big0=rotate(a,2)^rotate(a,13)^rotate(a,22)
      const majority=(a&b)^(a&c)^(b&c)
      const temp2=(big0+majority)>>>0
      h=g;g=f;f=e;e=(d+temp1)>>>0;d=c;c=b;b=a;a=(temp1+temp2)>>>0
    }
    state[0]=(state[0]+a)>>>0;state[1]=(state[1]+b)>>>0;state[2]=(state[2]+c)>>>0;state[3]=(state[3]+d)>>>0
    state[4]=(state[4]+e)>>>0;state[5]=(state[5]+f)>>>0;state[6]=(state[6]+g)>>>0;state[7]=(state[7]+h)>>>0
  }
  return state.map(value=>value.toString(16).padStart(8,'0')).join('')
}
const hashShareToken=async(token:string)=>{
  if(globalThis.crypto?.subtle)return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),value=>value.toString(16).padStart(2,'0')).join('')
  return sha256Fallback(token)
}
const getShareBaseUrl=()=>{
  const isLocalHost=['localhost','127.0.0.1','::1'].includes(window.location.hostname)
  return isLocalHost?(import.meta.env.VITE_SHARE_BASE_URL?.trim()||window.location.origin):window.location.origin
}

const initialNotices: Notice[] = [
  { id: 1, title: 'Approval needed today', detail: 'Q2 launch hero video is waiting for final review.', time: '12 min ago', kind: 'urgent', read: false },
  { id: 2, title: 'Deadline at risk', detail: 'Creator economy reel has 2 incomplete tasks and is due in 2 hours.', time: '38 min ago', kind: 'urgent', read: false },
  { id: 3, title: 'Video is trending', detail: '“How we plan 30 days of content” passed 480K views.', time: '1 hr ago', kind: 'performance', read: false },
  { id: 4, title: 'Review completed', detail: 'Maya approved the Studio Day short for scheduling.', time: '2 hrs ago', kind: 'approval', read: false },
  { id: 5, title: 'New task assigned', detail: 'You were assigned to approve three campaign thumbnails.', time: 'Yesterday', kind: 'assignment', read: true },
]

const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Team', icon: Users },
  { label: 'Projects', icon: FolderKanban }, { label: 'Connection', icon: Link2 }, { label: 'Calendar', icon: CalendarDays },
  { label: 'Plugins', icon: Plug }, { label: 'APIs', icon: Link2 }, { label: 'Video analytics', icon: Play }, { label: 'Engine', icon: Zap },
  { label: 'Reports', icon: FileText }, { label: 'Database', icon: Database }, { label: 'Notifications', icon: Bell },
  { label: 'Settings', icon: Settings },
]

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${className}`} {...props}>{children}</button>
}
function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}
function Avatar({ initials, color = 'violet', image }: { initials: string; color?: string; image?: string }) {
  return <span className={`avatar avatar-${color}`}>{image?<img src={image} alt="Profile"/>:initials}</span>
}

function KpiCard({ title, value, delta, icon: Icon, tone }: { title: string; value: string; delta: string; icon: typeof Activity; tone: string }) {
  const up = !delta.startsWith('-')
  return (
    <Card className="kpi-card">
      <div className={`icon-box icon-${tone}`}><Icon size={18} /></div>
      <div className="kpi-label">{title}</div>
      <div className="kpi-row"><strong>{value}</strong><span className={up ? 'delta-up' : 'delta-down'}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta}</span></div>
      <div className="kpi-caption">vs previous period</div>
    </Card>
  )
}

function Dashboard({ range, setRange, userName, project, workers, socialMetrics, onGoTeam, onUpdateWorker }: { range: Range; setRange: (r: Range) => void; userName: string; project?: Project; workers: Worker[]; socialMetrics: SocialMetric[]; onGoTeam: () => void; onUpdateWorker: (worker: Worker) => void }) {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Approve product launch edit', meta: 'Q2 Launch · Due in 2h', done: false },
    { id: 2, title: 'Review creator partnership script', meta: 'Campaigns · Due today', done: false },
    { id: 3, title: 'Upload final thumbnails', meta: 'Weekly Series · Completed', done: true },
  ])
  const [workflowMenu, setWorkflowMenu] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [allDoneMessage, setAllDoneMessage] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const selectedWorker = workers.find(worker=>worker.id===selectedWorkerId) || null
  const data = project ? trendData[range] : trendData[range].map(point=>({...point,produced:point.produced*42000,published:point.published*31000}))
  const totalTeamTasks=workers.reduce((sum,worker)=>sum+worker.tasks,0)
  const completedTeamTasks=workers.reduce((sum,worker)=>sum+worker.done,0)
  const workflowHealth=totalTeamTasks?Math.round(completedTeamTasks/totalTeamTasks*100):0
  const inProgressWorkers=workers.filter(worker=>worker.done>0&&worker.done<worker.tasks).length
  const completedWorkers=workers.filter(worker=>worker.tasks>0&&worker.done===worker.tasks).length
  const notStartedWorkers=workers.filter(worker=>worker.done===0).length
  const totalReach=socialMetrics.reduce((sum,item)=>sum+item.reach,0)
  const projectTrendData=[
    {name:'Social content',value:socialMetrics.length},
    {name:'Tasks done',value:completedTeamTasks},
    {name:'Social reach',value:totalReach},
    {name:'Tasks remaining',value:Math.max(0,totalTeamTasks-completedTeamTasks)},
  ]
  const currentDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
  const allTasksDone = tasks.length > 0 && tasks.every(task => task.done)
  useEffect(() => {
    if (!allTasksDone) return
    setAllDoneMessage(true)
    const timer = window.setTimeout(() => setAllDoneMessage(false), 3000)
    return () => window.clearTimeout(timer)
  }, [allTasksDone])
  const addTask = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTask.trim()) return
    setTasks(current => [...current, { id: Date.now(), title: newTask.trim(), meta: 'Personal task · Just added', done: false }])
    setNewTask('')
    setAddingTask(false)
  }
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">{currentDate}</p><h1>{userName?`Good morning, ${userName}`:'Welcome to Flowcast'}</h1><p>{project?`Active project: ${project.name}`:'Demo overview · Create or open a project to begin your own workflow.'}</p></div>
      <div className="range-tabs">{(['Today', '7 days', '30 days', 'Quarter', 'Year'] as Range[]).map(r => <Button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</Button>)}</div>
    </div>
    <div className="kpi-grid">
      <KpiCard title="Social content" value={String(socialMetrics.length)} delta={socialMetrics.length?'+ Live':'0'} icon={Video} tone="violet" />
      <KpiCard title="Team tasks done" value={`${completedTeamTasks}/${totalTeamTasks}`} delta={`${workflowHealth}%`} icon={Check} tone="green" />
      <KpiCard title="Social reach" value={totalReach.toLocaleString()} delta={totalReach?'+ Synced':'0'} icon={Zap} tone="blue" />
      <KpiCard title="Team remaining" value={String(Math.max(0,totalTeamTasks-completedTeamTasks))} delta={workflowHealth===100?'+ Done':'0'} icon={Clock3} tone="orange" />
    </div>
    <div className="dashboard-grid">
      <Card className="chart-card wide">
        <div className="card-head"><div><h2>{project?'Project production trends':'Production trends'}</h2><p>{project?'Live signals for this project':'Content created and published'}</p></div><Badge tone={project?'violet':'green'}><span className="dot" /> {project?project.name:'Live'}</Badge></div>
        <div className="chart-wrap">
          {project?<ResponsiveContainer width="100%" height="100%"><BarChart data={projectTrendData} margin={{top:14,right:8,bottom:0,left:-15}}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}}/><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:12}}/><Bar dataKey="value" fill="var(--accent)" radius={[8,8,2,2]}/></BarChart></ResponsiveContainer>:<ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: -24 }}>
              <defs><linearGradient id="produced" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.35}/><stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }} />
              <Area type="monotone" dataKey="produced" stroke="var(--accent)" strokeWidth={2.5} fill="url(#produced)" />
              <Area type="monotone" dataKey="published" stroke="var(--cyan)" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>}
        </div>
      </Card>
      <Card className="chart-card">
        <div className="card-head"><div><h2>Workflow health</h2><p>{completedTeamTasks} of {totalTeamTasks} team tasks completed</p></div><div className="card-menu-wrap"><Button className="icon-button" onClick={()=>setWorkflowMenu(open=>!open)} aria-label="Workflow options"><MoreHorizontal size={18}/></Button>{workflowMenu&&<div className="card-menu"><button onClick={()=>setWorkflowMenu(false)}>View workflow details</button><button onClick={()=>setWorkflowMenu(false)}>Review overdue items</button><button onClick={()=>setWorkflowMenu(false)}>Export summary</button></div>}</div></div>
        <div className="donut-row">
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={totalTeamTasks?[{v:completedTeamTasks},{v:Math.max(0,totalTeamTasks-completedTeamTasks)}]:[{v:1}]} dataKey="v" innerRadius={52} outerRadius={70} paddingAngle={4} stroke="none">{(totalTeamTasks?['var(--green)','var(--line)']:['var(--line)']).map(c => <Cell key={c} fill={c}/>)}</Pie></PieChart></ResponsiveContainer>
            <div className="donut-center"><strong>{workflowHealth}%</strong><span>{workers.length?'completed':'no team'}</span></div>
          </div>
          <div className="legend"><span><i className="purple"/>In progress <b>{inProgressWorkers}</b></span><span><i className="cyan"/>Completed <b>{completedWorkers}</b></span><span><i className="amber"/>Not started <b>{notStartedWorkers}</b></span><span><i className="rose"/>Team members <b>{workers.length}</b></span></div>
        </div>
      </Card>
      <Card className="content-card wide">
        <div className="card-head"><div><h2>Content pipeline</h2><p>Live team assignments and production progress</p></div><Button className="link-button" onClick={onGoTeam}>Manage team <span>→</span></Button></div>
        {workers.length>0?<div className="table-wrap"><table><thead><tr><th>Worker & responsibility</th><th>Stage</th><th>Status</th><th>Due</th><th>Progress</th></tr></thead><tbody>{workers.map(worker => { const progress=worker.tasks?Math.round(worker.done/worker.tasks*100):0; return <tr className={`pipeline-row ${project?'':'demo-row'}`} key={worker.id} onClick={()=>project&&setSelectedWorkerId(worker.id)}><td><div className="title-cell"><Avatar initials={worker.initials} color={worker.color}/><div><b>{worker.name}</b><small>{worker.role} · {worker.info}</small></div></div></td><td><Badge tone={worker.stage==='Review'?'orange':worker.stage==='Approved'?'green':'violet'}>{worker.stage}</Badge></td><td>{project?<Badge tone={worker.status==='Available'?'green':worker.status==='Busy'?'orange':'neutral'}>{worker.status}</Badge>:<Badge>Demo</Badge>}</td><td>{new Date(`${worker.due}T00:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</td><td><div className="progress-cell"><span><i style={{width:`${progress}%`}}/></span><b>{progress}%</b></div></td></tr>})}</tbody></table></div>:<div className="pipeline-empty"><Users size={22}/><div><b>No team assignments yet</b><small>Add your own worker and role-based tasks will be created automatically.</small></div><Button onClick={onGoTeam}><CirclePlus size={15}/> Add worker</Button></div>}
      </Card>
      <Card className="tasks-card">
        <div className="card-head"><div><h2>My focus</h2><p>{tasks.filter(t => !t.done).length} tasks remaining</p></div><Button className={`icon-button ${addingTask ? 'active-add' : ''}`} onClick={()=>setAddingTask(open=>!open)} aria-label="Add focus task">{addingTask?<X size={18}/>:<CirclePlus size={18}/>}</Button></div>
        {addingTask&&<form className="quick-task-form" onSubmit={addTask}><input autoFocus value={newTask} onChange={event=>setNewTask(event.target.value)} placeholder="What needs to be done?"/><Button type="submit" className="primary">Add</Button></form>}
        <div className="task-list">{tasks.map(task => <div className={`task ${task.done ? 'done' : ''}`} key={task.id}><label className="task-check"><input type="checkbox" checked={task.done} onChange={() => setTasks(v => v.map(t => t.id === task.id ? {...t, done: !t.done} : t))}/><span className="fake-check"><Check size={12}/></span><span><b>{task.title}</b><small>{task.meta}</small></span></label><button className="task-remove" onClick={()=>setTasks(current=>current.filter(item=>item.id!==task.id))} aria-label={`Remove ${task.title}`} title="Remove task"><X size={14}/></button></div>)}</div>
      </Card>
    </div>
    {allDoneMessage&&<div className="completion-toast"><span><Check size={16}/></span><div><b>Great work!</b><small>All focus tasks are complete.</small></div></div>}
    {selectedWorker&&<WorkerPerformanceModal worker={selectedWorker} onClose={()=>setSelectedWorkerId(null)} onUpdate={onUpdateWorker}/>}
  </>
}

function TeamPage({ project, starter, workers, onAdd, onDelete, onUpdate }: { project?: Project; starter?: boolean; workers: Worker[]; onAdd: (worker: Worker) => void; onDelete: (worker: Worker) => void; onUpdate: (worker: Worker) => void }) {
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Worker | null>(null)
  const selected = workers.find(worker=>worker.id===selectedId) || null
  const shown = workers.filter(m => `${m.name} ${m.role}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className="page-heading"><div><p className="eyebrow">{project?project.name:'Starter workspace'} · {workers.length}/20 members</p><h1>Team management</h1><p>{project?'This team and its progress belong only to the active project.':'Edit, remove, or expand the default starter team before creating a project.'}</p></div><Button className="primary" disabled={(!project&&!starter)||workers.length>=20} onClick={()=>setAddOpen(true)}><CirclePlus size={17}/> {workers.length>=20?'Team limit reached':'Add worker'}</Button></div>
    <div className="toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workers or roles…"/></div><Button>All roles <ChevronDown size={15}/></Button><Button>All statuses <ChevronDown size={15}/></Button></div>
    <div className="team-grid">{shown.map(member => <Card className="member-card" key={member.id}><div className="member-top"><Avatar initials={member.initials} color={member.color}/><div className="member-actions"><Badge tone={member.status === 'Available' ? 'green' : member.status === 'Busy' ? 'orange' : 'neutral'}>{member.status}</Badge><button className="delete-icon edit-icon" onClick={()=>setEditing(member)} aria-label={`Edit ${member.name}`} title="Edit worker"><Settings size={14}/></button><button className="delete-icon" onClick={()=>onDelete(member)} aria-label={`Delete ${member.name}`} title="Delete worker"><Trash2 size={14}/></button></div></div><h3>{member.name}</h3><p className="member-role">{member.role}</p><p className="member-info">{member.info}</p><div className="member-stats"><span><b>{member.tasks}</b> Assigned</span><span><b>{member.done}</b> Completed</span><span><b>{member.tasks ? Math.round(member.done/member.tasks*100) : 0}%</b> Progress</span></div><div className="progress"><i style={{width:`${member.tasks ? member.done/member.tasks*100 : 0}%`}}/></div><Button className="full" onClick={()=>setSelectedId(member.id)}>Open tasks</Button></Card>)}</div>
    {shown.length===0&&<Card className="team-empty"><Users size={24}/><b>{workers.length ? 'No workers found' : 'Build your team'}</b><small>{workers.length ? 'Try another search.' : 'Add your first worker to assign projects and track performance.'}</small><Button className="primary" onClick={()=>setAddOpen(true)}><CirclePlus size={15}/> Add first worker</Button></Card>}
    {addOpen&&<AddWorkerModal onClose={()=>setAddOpen(false)} onAdd={worker=>{onAdd(worker);setAddOpen(false)}}/>}
    {editing&&<EditWorkerModal worker={editing} onClose={()=>setEditing(null)} onSave={worker=>{onUpdate(worker);setEditing(null)}}/>}
    {selected&&<WorkerPerformanceModal worker={selected} onClose={()=>setSelectedId(null)} onUpdate={onUpdate}/>}
  </>
}

function AddWorkerModal({ onClose, onAdd }: { onClose: () => void; onAdd: (worker: Worker) => void }) {
  const [form, setForm] = useState({ name: '', role: '', info: '', status: 'Available' })
  const [error, setError] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.role.trim()) return setError('Name and role are required.')
    const initials = form.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
    const due = new Date(); due.setDate(due.getDate()+7)
    const workTasks = taskSet(form.role.trim())
    onAdd({ id: Date.now(), name: form.name.trim(), role: form.role.trim(), info: form.info.trim() || 'New team member.', initials, tasks: workTasks.length, done: 0, status: form.status, color: 'violet', stage: 'Idea', due: due.toISOString().slice(0,10), workTasks })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="modal worker-modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><span className="modal-icon"><Users size={20}/></span><div><p className="eyebrow">Team member</p><h2>Add a worker</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div>
    <p className="modal-intro">Add their name first, then specify who they are and what they do.</p>
    <form onSubmit={submit}><label className="field field-full"><span>Worker name <i>Required</i></span><input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter full name"/></label>
      <label className="field field-full"><span>Role or title <i>Required</i></span><input list="worker-roles" value={form.role} onChange={e=>setForm({...form,role:e.target.value})} placeholder="e.g. Video Editor"/><datalist id="worker-roles">{['Admin','Content Creator','Scriptwriter','Cameraman','Video Editor','Designer','Social Media Manager','Reviewer'].map(role=><option key={role} value={role}/>)}</datalist></label>
      <label className="field field-full"><span>Short information</span><textarea value={form.info} onChange={e=>setForm({...form,info:e.target.value})} placeholder="Main responsibility or expertise"/></label>
      <label className="field field-full"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Available</option><option>Busy</option><option>Away</option></select></label>
      {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary"><CirclePlus size={16}/> Add worker</Button></div>
    </form></div></div>
}

function EditWorkerModal({ worker, onClose, onSave }: { worker: Worker; onClose: () => void; onSave: (worker: Worker) => void }) {
  const [form,setForm]=useState({name:worker.name,role:worker.role,info:worker.info,status:worker.status,due:worker.due})
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(!form.name.trim()||!form.role.trim())return;const parts=form.name.trim().split(/\s+/);onSave({...worker,...form,name:form.name.trim(),role:form.role.trim(),info:form.info.trim(),initials:parts.map(part=>part[0]).join('').slice(0,2).toUpperCase()})}
  return <div className="modal-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="modal worker-modal"><div className="modal-head"><div><span className="modal-icon"><Settings size={19}/></span><div><p className="eyebrow">Team profile</p><h2>Edit worker</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div><p className="modal-intro">Update the worker’s identity, responsibility, availability, or due date.</p><form onSubmit={submit}><div className="form-grid"><label className="field"><span>Name</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Role</span><input value={form.role} onChange={e=>setForm({...form,role:e.target.value})}/></label><label className="field field-full"><span>Short information</span><textarea value={form.info} onChange={e=>setForm({...form,info:e.target.value})}/></label><label className="field"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Available</option><option>Busy</option><option>Away</option></select></label><label className="field"><span>Due date</span><input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label></div><div className="modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary"><Check size={15}/> Save changes</Button></div></form></div></div>
}

function WorkerPerformanceModal({ worker, onClose, onUpdate }: { worker: Worker; onClose: () => void; onUpdate: (worker: Worker) => void }) {
  const completion = worker.tasks ? Math.round(worker.done/worker.tasks*100) : 0
  const updateTask=(taskId:number,changes:Partial<WorkTask>)=>{
    const workTasks=worker.workTasks.map(task=>task.id===taskId?{...task,...changes}:task)
    const done=workTasks.filter(task=>task.done).length
    const stage=done===workTasks.length?'Approved':done>0?'In progress':'Idea'
    onUpdate({...worker,workTasks,tasks:workTasks.length,done,stage})
  }
  return <div className="modal-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="modal performance-modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><Avatar initials={worker.initials} color={worker.color}/><div><p className="eyebrow">{worker.role}</p><h2>{worker.name}</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div>
    <p className="modal-intro">{worker.info}</p><div className="worker-process-banner"><span><small>Current process</small><Badge tone="violet">{worker.stage}</Badge></span><span><small>Due date</small><b>{new Date(`${worker.due}T00:00:00`).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</b></span><span><small>Availability</small><Badge tone={worker.status==='Available'?'green':'orange'}>{worker.status}</Badge></span></div><div className="performance-grid"><div><small>Assigned tasks</small><b>{worker.tasks}</b></div><div><small>Completed</small><b>{worker.done}</b></div><div><small>Completion rate</small><b>{completion}%</b></div><div><small>Open tasks</small><b>{Math.max(0,worker.tasks-worker.done)}</b></div></div>
    <div className="performance-chart-head"><span><b>Assigned checklist</b><small>Checking a task updates progress everywhere</small></span><b>{worker.done}/{worker.tasks}</b></div>
    <div className="worker-task-list">{worker.workTasks.map(task=><div className={`worker-task ${task.done?'done':''}`} key={task.id}><label><input type="checkbox" checked={task.done} onChange={()=>updateTask(task.id,{done:!task.done})}/><span className="fake-check"><Check size={12}/></span><span>{task.title}</span></label>{task.requiresUpload&&<label className="upload-control"><input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)updateTask(task.id,{fileName:file.name})}}/><Library size={14}/>{task.fileName||'Add thumbnail'}</label>}</div>)}</div>
    <div className="performance-chart-head"><span><b>Progress trend</b><small>Current completion by task</small></span><Badge tone="green">{worker.status}</Badge></div>
    <div className="mini-bars">{worker.workTasks.map((task,index)=><span key={task.id}><i style={{height:task.done?'100%':'12%'}}/><small>T{index+1}</small></span>)}</div>
    <div className="modal-actions"><Button onClick={onClose}>Close</Button></div>
  </div></div>
}

function VideoAnalytics({ projects, activeProjectId, analytics, socialMetrics, onUpdate }: { projects: Project[]; activeProjectId: number|null; analytics: Record<number,AnalyticsData>; socialMetrics: SocialMetric[]; onUpdate: (projectId:number,data:AnalyticsData)=>void }) {
  const [selectedId,setSelectedId]=useState<number|null>(activeProjectId)
  useEffect(()=>setSelectedId(activeProjectId),[activeProjectId])
  const selected=projects.find(project=>project.id===selectedId)||null
  const demoViews=demoSocialMetrics.reduce((sum,item)=>sum+item.views,0)
  const demoInteractions=demoSocialMetrics.reduce((sum,item)=>sum+item.likes+item.comments+item.shares,0)
  const demoEngagement=(demoInteractions/demoViews*100).toFixed(1)
  const demoChart=[{name:'Views',value:demoViews},{name:'Likes',value:demoSocialMetrics.reduce((sum,item)=>sum+item.likes,0)},{name:'Comments',value:demoSocialMetrics.reduce((sum,item)=>sum+item.comments,0)},{name:'Shares',value:demoSocialMetrics.reduce((sum,item)=>sum+item.shares,0)}]
  if(!selected)return <><div className="page-heading"><div><p className="eyebrow">High-performance demo</p><h1>Video analytics</h1><p>Explore a complete default analytics dashboard. Every user-created project starts from zero.</p></div><Badge tone="green">Demo data</Badge></div><div className="kpi-grid project-kpis"><Card><small>Total views</small><b>{demoViews.toLocaleString()}</b></Card><Card><small>Engagement rate</small><b>{demoEngagement}%</b></Card><Card><small>Total interactions</small><b>{demoInteractions.toLocaleString()}</b></Card><Card><small>Uploaded content</small><b>{demoSocialMetrics.length}</b></Card></div><Card className="analytics-chart-card"><div className="card-head"><div><h2>Default performance graph</h2><p>High-reach sample content across social platforms</p></div><Badge tone="green">Trending</Badge></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={demoChart}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}}/><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:12}}/><Bar dataKey="value" fill="var(--accent)" radius={[8,8,2,2]}/></BarChart></ResponsiveContainer></div></Card>{projects.length>0&&<div className="project-grid analytics-project-picker">{projects.map(project=><Card className="analytics-project clickable" key={project.id}><div onClick={()=>setSelectedId(project.id)}><div className="project-card-head"><span className="project-icon"><Play size={18}/></span><Badge tone="violet">Open</Badge></div><h3>{project.name}</h3><p>{project.description}</p></div></Card>)}</div>}</>
  const manual=analytics[selected.id]||{mediaName:'',contentType:'Video',views:0,likes:0,comments:0,shares:0}
  const social=socialMetrics.filter(item=>item.projectId===selected.id)
  const data={...manual,views:manual.views+social.reduce((sum,item)=>sum+item.views,0),likes:manual.likes+social.reduce((sum,item)=>sum+item.likes,0),comments:manual.comments+social.reduce((sum,item)=>sum+item.comments,0),shares:manual.shares+social.reduce((sum,item)=>sum+item.shares,0)}
  const engagement=data.views?((data.likes+data.comments+data.shares)/data.views*100).toFixed(1):'—'
  const update=(changes:Partial<AnalyticsData>)=>onUpdate(selected.id,{...manual,...changes})
  const performance=data.views===0?'No data':Number(engagement)>=8?'Trending':Number(engagement)>=3?'Average':'Low performing'
  const metricData=[{name:'Views',value:data.views},{name:'Likes',value:data.likes},{name:'Comments',value:data.comments},{name:'Shares',value:data.shares}]
  return <><div className="project-overview-top"><Button onClick={()=>setSelectedId(null)}><ArrowLeft size={16}/> All analytics projects</Button><Badge tone={performance==='Trending'?'green':performance==='Low performing'?'orange':'violet'}>{performance}</Badge></div><div className="page-heading"><div><p className="eyebrow">{selected.type} · Analytics</p><h1>{selected.name}</h1><p>{selected.description}</p></div></div><div className="kpi-grid project-kpis"><Card><small>Total views</small><b>{data.views.toLocaleString()}</b></Card><Card><small>Engagement rate</small><b>{engagement}{engagement!=='—'?'%':''}</b></Card><Card><small>Total interactions</small><b>{(data.likes+data.comments+data.shares).toLocaleString()}</b></Card><Card><small>Updated content</small><b>{social.length+(manual.mediaName?1:0)}</b></Card></div><div className="analytics-workspace"><Card className="analytics-entry"><div className="card-head"><div><h2>Verified content metrics</h2><p>Manual entry plus {social.length} plugin records</p></div></div><label className="field analytics-type"><span>Content format</span><select value={manual.contentType} onChange={event=>update({contentType:event.target.value})}><option>Video</option><option>Image</option><option>Reel / Short</option></select></label><label className="analytics-upload"><Upload size={20}/><span><b>{manual.mediaName||`Upload ${manual.contentType.toLowerCase()}`}</b><small>MP4, MOV, JPG or PNG</small></span><input type="file" accept="video/*,image/*" onChange={event=>{const file=event.target.files?.[0];if(file)update({mediaName:file.name})}}/></label><div className="metrics-grid">{(['views','likes','comments','shares'] as const).map(field=><label className="field" key={field}><span>{field[0].toUpperCase()+field.slice(1)}</span><input type="number" min="0" value={manual[field]} onChange={event=>update({[field]:Number(event.target.value)})}/></label>)}</div></Card><Card className="analytics-growth"><div className="card-head"><div><h2>Performance overview</h2><p>Classified from verified engagement</p></div><Badge tone={performance==='Trending'?'green':'violet'}>{performance}</Badge></div>{data.views?<div className="growth-visual"><strong>{engagement}%</strong><span>engagement rate</span><div className="growth-bars">{[data.likes,data.comments,data.shares].map((value,index)=><i key={index} style={{height:`${Math.max(8,Math.min(100,value/Math.max(1,data.likes,data.comments,data.shares)*100))}%`}}/>)}</div></div>:<div className="analytics-mini-empty"><Activity size={25}/><b>Starting from zero</b><small>Enter real metrics to reveal growth or decline.</small></div>}</Card></div><Card className="analytics-chart-card"><div className="card-head"><div><h2>Views and engagement graph</h2><p>Manual and social plugin metrics combined</p></div><Badge tone="violet">{manual.contentType}</Badge></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={metricData}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}}/><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:12}}/><Bar dataKey="value" fill="var(--accent)" radius={[8,8,2,2]}/></BarChart></ResponsiveContainer></div></Card></>
}

function EnginePage({ project, analytics }: { project?: Project; analytics?: AnalyticsData }) {
  const [type,setType]=useState('Video')
  const [views,setViews]=useState(analytics?.views||10000)
  const [comments,setComments]=useState(analytics?.comments||250)
  useEffect(()=>{setViews(analytics?.views||10000);setComments(analytics?.comments||250)},[project?.id,analytics?.views,analytics?.comments])
  const commentRate=views?comments/views*100:0
  const tier=views>=100000?'High viral potential':views>=25000?'Strong growth potential':views>=5000?'Healthy organic reach':'Early-stage reach'
  const projectedReach=Math.round(views*(1+Math.min(.8,commentRate/5)))
  return <><div className="page-heading"><div><p className="eyebrow">Prediction sandbox · {project?.name||'Default workspace'}</p><h1>Flowcast Engine</h1><p>Explore hypothetical outcomes without changing verified analytics.</p></div><Badge tone="violet">Simulation only</Badge></div><div className="engine-layout"><Card className="engine-controls"><div className="card-head"><div><h2>Set your scenario</h2><p>Choose content and expected engagement</p></div><Sparkles size={19}/></div><label className="field"><span>Content type</span><select value={type} onChange={event=>setType(event.target.value)}><option>Video</option><option>Photo</option><option>Reel / Short</option></select></label><label className="engine-range"><span><b>Expected views</b><strong>{views.toLocaleString()}</strong></span><input type="range" min="0" max="500000" step="1000" value={views} onChange={event=>setViews(Number(event.target.value))}/></label><label className="engine-range"><span><b>Expected comments</b><strong>{comments.toLocaleString()}</strong></span><input type="range" min="0" max="25000" step="50" value={comments} onChange={event=>setComments(Number(event.target.value))}/></label></Card><Card className="engine-result"><span className="engine-orb"><Zap size={27}/></span><p>Predicted outcome for {type.toLowerCase()}</p><h2>{tier}</h2><div className="engine-stats"><span><small>Potential reach</small><b>{projectedReach.toLocaleString()}</b></span><span><small>Comment rate</small><b>{commentRate.toFixed(2)}%</b></span><span><small>Active project</small><b>{project?.name||'None'}</b></span></div><div className="engine-disclaimer">Prediction uses a simple scenario model, not guaranteed platform results.</div></Card></div></>
}

function ContentCalendar({ projects }: { projects: Project[] }) {
  const [month,setMonth]=useState(()=>{const date=new Date();return new Date(date.getFullYear(),date.getMonth(),1)})
  const year=month.getFullYear(), monthIndex=month.getMonth()
  const firstDay=new Date(year,monthIndex,1).getDay()
  const days=new Date(year,monthIndex+1,0).getDate()
  const cells=Array.from({length:firstDay+days},(_,index)=>index<firstDay?null:index-firstDay+1)
  const eventsFor=(day:number)=>{const key=`${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return projects.filter(project=>project.deadline===key).map(project=>({label:project.name,type:'project'}))}
  const today=new Date()
  const upcoming=projects.map(project=>({date:project.deadline,title:project.name})).filter(item=>new Date(`${item.date}T23:59:59`)>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6)
  return <><div className="page-heading"><div><p className="eyebrow">Project schedule</p><h1>Calendar</h1><p>Only your created project names and deadlines appear here.</p></div><div className="calendar-controls"><Button onClick={()=>setMonth(new Date(year,monthIndex-1,1))}><ChevronLeft size={16}/></Button><b>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</b><Button onClick={()=>setMonth(new Date(year,monthIndex+1,1))}><ChevronRight size={16}/></Button></div></div>
    <div className="calendar-layout"><Card className="calendar-card"><div className="calendar-legend"><span><i className="project-dot"/>Created projects</span></div><div className="calendar-week">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><b key={day}>{day}</b>)}</div><div className="calendar-grid">{cells.map((day,index)=><div className={`calendar-day ${day&&today.getFullYear()===year&&today.getMonth()===monthIndex&&today.getDate()===day?'today':''}`} key={index}>{day&&<><span>{day}</span><div>{eventsFor(day).map((event,eventIndex)=><button className="calendar-event project" key={eventIndex}>{event.label}</button>)}</div></>}</div>)}</div></Card><Card className="agenda-card"><div className="card-head"><div><h2>Upcoming projects</h2><p>Deadline overview</p></div><CalendarDays size={18}/></div><div className="agenda-list">{upcoming.map((item,index)=><div className="agenda-item" key={`${item.title}-${index}`}><span className="agenda-date"><b>{new Date(`${item.date}T00:00:00`).getDate()}</b><small>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined,{month:'short'})}</small></span><div><b>{item.title}</b><small>Project deadline</small></div></div>)}{upcoming.length===0&&<div className="agenda-empty">Create a project to add it here.</div>}</div></Card></div>
  </>
}

const platforms = [
  {name:'Instagram',icon:Video,color:'pink',url:'https://www.instagram.com/'},{name:'YouTube',icon:Play,color:'red',url:'https://www.youtube.com/'},
  {name:'Facebook',icon:Users,color:'blue',url:'https://www.facebook.com/'},{name:'LinkedIn',icon:Library,color:'blue',url:'https://www.linkedin.com/'},
  {name:'TikTok',icon:Music2,color:'dark',url:'https://www.tiktok.com/'},{name:'X / Twitter',icon:Globe2,color:'dark',url:'https://x.com/'},
  {name:'Pinterest',icon:Globe2,color:'red',url:'https://www.pinterest.com/'},{name:'Threads',icon:Globe2,color:'dark',url:'https://www.threads.net/'},
  {name:'Snapchat',icon:Globe2,color:'yellow',url:'https://www.snapchat.com/'},{name:'Reddit',icon:Globe2,color:'orange',url:'https://www.reddit.com/'},
  {name:'Vimeo',icon:Video,color:'cyan',url:'https://vimeo.com/'},{name:'Twitch',icon:Play,color:'violet',url:'https://www.twitch.tv/'},
]

const apiPlatformDetails: Record<string,{purpose:string;access:string;docs:string}> = {
  Instagram: {purpose:'Reels, posts, comments and account insights',access:'Meta professional account',docs:'https://developers.facebook.com/docs/instagram-platform/'},
  YouTube: {purpose:'Videos, channel analytics and comments',access:'Google Cloud project',docs:'https://developers.google.com/youtube/'},
  Facebook: {purpose:'Pages, posts, reach and engagement',access:'Meta business app',docs:'https://developers.facebook.com/docs/pages-api/'},
  LinkedIn: {purpose:'Company posts and audience performance',access:'LinkedIn developer app',docs:'https://learn.microsoft.com/linkedin/'},
  TikTok: {purpose:'Video publishing and creator insights',access:'TikTok developer app',docs:'https://developers.tiktok.com/'},
  'X / Twitter': {purpose:'Posts, mentions and engagement data',access:'X developer project',docs:'https://developer.x.com/'},
  Pinterest: {purpose:'Pins, boards and organic analytics',access:'Pinterest developer app',docs:'https://developers.pinterest.com/'},
  Threads: {purpose:'Threads posts and account insights',access:'Meta developer app',docs:'https://developers.facebook.com/docs/threads/'},
  Snapchat: {purpose:'Public profile and campaign insights',access:'Snap developer app',docs:'https://developers.snap.com/'},
  Reddit: {purpose:'Posts, communities and comment activity',access:'Reddit developer app',docs:'https://www.reddit.com/dev/api/'},
  Vimeo: {purpose:'Video library, plays and engagement',access:'Vimeo developer app',docs:'https://developer.vimeo.com/'},
  Twitch: {purpose:'Streams, channel and audience data',access:'Twitch developer app',docs:'https://dev.twitch.tv/docs/'},
}

function ApiDesk({ project, connected, onConnect, onDisconnect }: { project?:Project; connected:string[]; onConnect:(platform:string)=>void; onDisconnect:(platform:string)=>void }) {
  const [selected,setSelected]=useState<string|null>(null)
  const [query,setQuery]=useState('')
  const shown=platforms.filter(item=>item.name.toLowerCase().includes(query.toLowerCase()))
  const selectedPlatform=platforms.find(item=>item.name===selected)
  const selectedDetails=selected?apiPlatformDetails[selected]:null
  return <>
    <div className="page-heading api-desk-heading">
      <div><p className="eyebrow">Connection centre · {project?.name||'No active project'}</p><h1>API Desk</h1><p>One simple place to prepare and manage every social media connection.</p></div>
      <Badge tone={project?'violet':'orange'}>{project?`${connected.length} of ${platforms.length} ready`:'Project required'}</Badge>
    </div>
    <Card className="api-security-banner">
      <span><ShieldCheck size={22}/></span>
      <div><b>Your passwords never go into Flowcast</b><small>Use each platform’s official developer portal. This frontend desk stores setup status only—not API keys, access tokens, or passwords.</small></div>
      <Badge tone="green">Safe setup</Badge>
    </Card>
    <div className="api-steps">
      <Card><span>1</span><div><b>Choose a platform</b><small>Select the social account you want to prepare.</small></div></Card>
      <i/>
      <Card><span>2</span><div><b>Create official access</b><small>Follow the provider’s developer setup.</small></div></Card>
      <i/>
      <Card><span>3</span><div><b>Connect securely later</b><small>OAuth becomes available with a backend.</small></div></Card>
    </div>
    <div className="api-desk-toolbar">
      <div className="search-field"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find Instagram, YouTube, TikTok…"/></div>
      <div className="api-summary"><span><i className="api-status-dot ready"/>{connected.length} ready</span><span><i className="api-status-dot"/>{platforms.length-connected.length} to set up</span></div>
    </div>
    <div className="api-platform-grid">{shown.map(({name,icon:Icon,color})=>{
      const isReady=connected.includes(name)
      const details=apiPlatformDetails[name]
      return <Card className={`api-platform-card ${isReady?'is-ready':''}`} key={name}>
        <div className="api-platform-top"><span className={`plugin-logo plugin-${color}`}><Icon size={22}/></span><Badge tone={isReady?'green':'neutral'}>{isReady?'Setup ready':'Not set up'}</Badge></div>
        <h3>{name}</h3>
        <p>{details.purpose}</p>
        <div className="api-requirement"><KeyRound size={13}/><span>{details.access}</span></div>
        <Button className={isReady?'full':'primary full'} onClick={()=>setSelected(name)}>{isReady?<><Settings size={14}/> Manage setup</>:<><Link2 size={14}/> Start setup</>}</Button>
      </Card>
    })}</div>
    {shown.length===0&&<Card className="api-empty"><Search size={21}/><b>No platform found</b><small>Try another platform name.</small></Card>}
    <Card className="api-live-note"><RefreshCw size={19}/><div><b>About live 24-hour syncing</b><small>Continuous syncing needs a secure backend, approved provider credentials, OAuth callbacks, and scheduled jobs. This screen intentionally does not pretend that a frontend-only connection is live.</small></div><Badge tone="orange">Backend needed</Badge></Card>
    {selected&&selectedPlatform&&selectedDetails&&<div className="modal-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&setSelected(null)}><div className="modal api-setup-modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><span className={`plugin-logo plugin-${selectedPlatform.color}`}><selectedPlatform.icon size={21}/></span><div><p className="eyebrow">Platform setup</p><h2>Connect {selected}</h2></div></div><Button className="icon-button" onClick={()=>setSelected(null)}><X size={18}/></Button></div>
      <p className="modal-intro">Complete these steps in order. Flowcast will never ask for your social media password.</p>
      <div className="api-setup-list">
        <div><span>1</span><div><b>Open the official developer portal</b><small>Create or select your developer application.</small></div><a href={selectedDetails.docs} target="_blank" rel="noreferrer">Open guide <ExternalLink size={13}/></a></div>
        <div><span>2</span><div><b>Request the required permissions</b><small>Choose read-only analytics permissions first. Provider review may be required.</small></div></div>
        <div><span>3</span><div><b>Add secure OAuth later</b><small>API secrets and tokens must be stored on a backend, never in this browser screen.</small></div></div>
      </div>
      {!project&&<div className="form-error">Create or open a project before saving platform setup status.</div>}
      <div className="modal-actions"><Button onClick={()=>setSelected(null)}>Close</Button>{connected.includes(selected)?<Button className="danger-button" onClick={()=>{onDisconnect(selected);setSelected(null)}}>Remove setup status</Button>:<Button className="primary" disabled={!project} onClick={()=>{onConnect(selected);setSelected(null)}}><Check size={15}/> Mark setup ready</Button>}</div>
    </div></div>}
  </>
}

function PluginsPage({ project, metrics, onAdd }: { project?: Project; metrics: SocialMetric[]; onAdd:(metric:SocialMetric)=>void }) {
  const [form,setForm]=useState({platform:'Instagram',account:'',contentType:'Reel / Short',title:'',mediaName:'',reach:'',views:'',likes:'',comments:'',shares:'',saves:''})
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(!project||!form.title.trim())return;onAdd({id:Date.now(),projectId:project.id,platform:form.platform,account:form.account.trim(),contentType:form.contentType,title:form.title.trim(),mediaName:form.mediaName,reach:Number(form.reach)||0,views:Number(form.views)||0,likes:Number(form.likes)||0,comments:Number(form.comments)||0,shares:Number(form.shares)||0,saves:Number(form.saves)||0});setForm({...form,title:'',mediaName:'',reach:'',views:'',likes:'',comments:'',shares:'',saves:''})}
  return <><div className="page-heading"><div><p className="eyebrow">Integrations · {project?.name||'No active project'}</p><h1>Social media plugins</h1><p>Open official platforms and record verified account performance.</p></div><Badge tone="violet">{platforms.length} platforms</Badge></div><div className="plugins-grid">{platforms.map(({name,icon:Icon,color,url})=><Card className="plugin-card" key={name}><span className={`plugin-logo plugin-${color}`}><Icon size={23}/></span><div><h3>{name}</h3><p>OAuth connection required for automatic access</p></div><Button onClick={()=>window.open(url,'_blank','noopener,noreferrer')}>Open <span>↗</span></Button></Card>)}</div><div className="social-sync-grid"><Card className="social-entry"><div className="card-head"><div><h2>Import verified performance</h2><p>{project?'Saved only to this project':'Open a project first'}</p></div><Activity size={18}/></div><form onSubmit={submit}><div className="metrics-grid"><label className="field"><span>Platform</span><select value={form.platform} onChange={event=>setForm({...form,platform:event.target.value})}>{platforms.map(item=><option key={item.name}>{item.name}</option>)}</select></label><label className="field"><span>Account handle</span><input value={form.account} onChange={event=>setForm({...form,account:event.target.value})} placeholder="@youraccount"/></label><label className="field"><span>Content type</span><select value={form.contentType} onChange={event=>setForm({...form,contentType:event.target.value})}><option>Video</option><option>Reel / Short</option><option>Photo</option><option>Story</option></select></label><label className="field"><span>Content name</span><input value={form.title} onChange={event=>setForm({...form,title:event.target.value})} placeholder="Campaign reel"/></label></div><label className="analytics-upload social-upload"><Upload size={18}/><span><b>{form.mediaName||'Choose video, reel, or photo'}</b><small>Local file reference for this project</small></span><input type="file" accept="video/*,image/*" onChange={event=>{const file=event.target.files?.[0];if(file)setForm({...form,mediaName:file.name})}}/></label><div className="metrics-grid">{(['reach','views','likes','comments','shares','saves'] as const).map(field=><label className="field" key={field}><span>{field[0].toUpperCase()+field.slice(1)}</span><input type="number" min="0" value={form[field]} onChange={event=>setForm({...form,[field]:event.target.value})}/></label>)}</div><Button type="submit" disabled={!project} className="primary social-save"><CirclePlus size={15}/> Add to project analytics</Button></form></Card><Card className="social-results"><div className="card-head"><div><h2>Tracked content</h2><p>{metrics.length} verified entries</p></div></div>{metrics.map(item=><div className="social-result" key={item.id}><span className="plugin-logo plugin-violet"><Activity size={16}/></span><div><b>{item.title}</b><small>{item.platform} · {item.contentType} · {item.reach.toLocaleString()} reach</small></div><strong>{item.views.toLocaleString()} views</strong></div>)}{metrics.length===0&&<div className="agenda-empty">No social metrics for this project.</div>}</Card></div><Card className="plugin-note"><Plug size={18}/><div><b>Automatic account analysis needs OAuth</b><small>A connected backend and each platform’s official API are required for secure account access. Until then, use verified manual metrics without sharing passwords.</small></div></Card></>
}

function SettingsPage({ profile, onEdit }: { profile: {name:string;role:string;image?:string}; onEdit: () => void }) {
  const initials=(profile.name.slice(0,2)||'WU').toUpperCase()
  return <><div className="page-heading"><div><p className="eyebrow">Workspace</p><h1>Settings</h1><p>Manage your profile and essential workspace preferences.</p></div></div><div className="settings-grid"><Card className="settings-card"><div className="settings-profile"><Avatar initials={initials} image={profile.image}/><div><h3>{profile.name||'No profile name'}</h3><p>{profile.role||'Add your role'}</p></div></div><Button onClick={onEdit}>Set up profile</Button></Card><Card className="settings-card"><span className="settings-icon"><Moon size={19}/></span><div><h3>Appearance</h3><p>Use the theme control in the top navigation.</p></div><Badge tone="green">Enabled</Badge></Card><Card className="settings-card"><span className="settings-icon"><Bell size={19}/></span><div><h3>Notifications</h3><p>Production alerts and deadline reminders.</p></div><Badge tone="green">On</Badge></Card></div></>
}

function ReportsPage({ reports, onAdd, onDelete }: { reports:WorkspaceReport[]; onAdd:(report:WorkspaceReport)=>void; onDelete:(id:number)=>void }) {
  const [form,setForm]=useState({title:'',author:'',body:''})
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(!form.title.trim()||!form.body.trim())return;onAdd({id:Date.now(),title:form.title.trim(),author:form.author.trim()||'Team member',body:form.body.trim(),createdAt:new Date().toISOString()});setForm({title:'',author:'',body:''})}
  return <><div className="page-heading"><div><p className="eyebrow">Team documentation</p><h1>Reports desk</h1><p>Write structured updates, findings, and production reports together.</p></div><Badge tone="violet">{reports.length} reports</Badge></div><div className="reports-layout"><Card className="report-editor"><div className="card-head"><div><h2>Create report</h2><p>Visible to your workspace team</p></div><BookOpen size={18}/></div><form onSubmit={submit}><label className="field"><span>Report title</span><input value={form.title} onChange={event=>setForm({...form,title:event.target.value})} placeholder="Weekly production summary"/></label><label className="field"><span>Written by</span><input value={form.author} onChange={event=>setForm({...form,author:event.target.value})} placeholder="Your name or teammate"/></label><label className="field"><span>Report details</span><textarea value={form.body} onChange={event=>setForm({...form,body:event.target.value})} placeholder="Progress, blockers, decisions, and next steps…"/></label><Button type="submit" className="primary"><FileText size={15}/> Publish report</Button></form></Card><div className="report-list">{reports.map(report=><Card className="report-card" key={report.id}><div className="report-card-top"><span className="report-icon"><FileText size={17}/></span><button className="delete-icon" onClick={()=>onDelete(report.id)}><Trash2 size={14}/></button></div><h3>{report.title}</h3><p>{report.body}</p><div><span>{report.author}</span><small>{new Date(report.createdAt).toLocaleDateString()}</small></div></Card>)}{reports.length===0&&<Card className="team-empty"><BookOpen size={24}/><b>No reports yet</b><small>Publish the first team report.</small></Card>}</div></div></>
}

function ConnectDesk({ projects, activeProjectId, remoteProjectIds, sharedProjectRoles, shareLinks, sessionReady, sessionError, syncError, joinError, onCreateLink, onRevokeLink }: { projects:Project[]; activeProjectId:number|null; remoteProjectIds:Record<number,string>; sharedProjectRoles:Record<number,'owner'|'member'>; shareLinks:Record<number,ShareLink[]>; sessionReady:boolean; sessionError:string; syncError:string; joinError:string; onCreateLink:(projectId:number,maxUses:number|null)=>Promise<void>; onRevokeLink:(projectId:number,inviteId:string)=>Promise<void> }) {
  const [selectedProjectId,setSelectedProjectId]=useState<number|null>(activeProjectId||projects[0]?.id||null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{if(activeProjectId)setSelectedProjectId(activeProjectId);else if(!selectedProjectId&&projects[0])setSelectedProjectId(projects[0].id)},[activeProjectId,projects])
  const selected=projects.find(project=>project.id===selectedProjectId)
  const create=async()=>{if(!selected)return;setBusy(true);setMessage('');try{await onCreateLink(selected.id,null);setMessage('Unlimited invite link created.')}catch(error){setMessage(error instanceof Error?error.message:'Could not create invite link.')}finally{setBusy(false)}}
  const isLocalHost=['localhost','127.0.0.1','::1'].includes(window.location.hostname)
  const shareBase=isLocalHost?import.meta.env.VITE_SHARE_BASE_URL?.trim():''
  const links=selected?(shareLinks[selected.id]||[]).map(link=>{
    if(!shareBase)return link
    try{
      const base=new URL(shareBase,window.location.origin)
      const inviteUrl=new URL(link.url,window.location.origin)
      inviteUrl.protocol=base.protocol;inviteUrl.host=base.host;inviteUrl.pathname=base.pathname
      return {...link,url:inviteUrl.toString()}
    }catch{return link}
  }):[]
  return <>
    <div className="page-heading"><div><p className="eyebrow">Project collaboration</p><h1>Connection</h1><p>Create a QR code or link that opens this project for collaborators.</p></div></div>
    {!sessionReady&&<Card className="connect-notice"><RefreshCw size={18}/><div><b>Connecting to Supabase</b><small>Preparing secure project access.</small></div></Card>}
    {sessionError&&<Card className="connect-notice connect-error"><AlertTriangle size={18}/><div><b>Anonymous access needs enabling</b><small>{sessionError} Enable Anonymous Sign-Ins in Supabase Auth settings, then reload.</small></div></Card>}
    {syncError&&<Card className="connect-notice connect-error"><AlertTriangle size={18}/><div><b>Project sync needs attention</b><small>{syncError}</small></div></Card>}
    {joinError&&<Card className="connect-notice connect-error"><AlertTriangle size={18}/><div><b>Could not join this project</b><small>{joinError}</small></div></Card>}
    <div className="connect-layout"><Card className="connect-create"><div className="card-head"><div><h2>Choose a project</h2><p>Members can open and update shared project progress.</p></div><Link2 size={18}/></div>
      <label className="field"><span>Project</span><select value={selectedProjectId??''} onChange={event=>setSelectedProjectId(Number(event.target.value)||null)}><option value="">Choose a project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      {selected&&<div className="connect-project-summary"><div><small>Project</small><b>{selected.name}</b></div><div><small>Access</small><b>{sharedProjectRoles[selected.id]==='member'?'Joined project':'Owner controls sharing and deletion'}</b></div><div><small>Cloud status</small><b>{remoteProjectIds[selected.id]?'Connected':'Ready to connect'}</b></div></div>}
      <Button className="primary connect-create-button" disabled={!selected||busy||!sessionReady||sharedProjectRoles[selected?.id||0]==='member'} onClick={()=>void create()}><Link2 size={16}/>{busy?'Updating link…':links.length?'Make current link unlimited':'Create unlimited invite QR and link'}</Button>
      {message&&<div className="connect-feedback">{message}</div>}
      <div className="connect-security-note"><ShieldCheck size={16}/><span>Anyone with this invite can open and edit the project. Only its owner can delete the project or revoke invites.</span></div>
      {isLocalHost&&shareBase?<div className="connect-network-note">Invite links open {shareBase}. Collaborators can join from any internet connection. Project updates sync through Supabase.</div>:isLocalHost&&<div className="connect-network-note">This preview link uses localhost. Another device needs a network-accessible or deployed Flowcast address.</div>}
    </Card><Card className="connect-links"><div className="card-head"><div><h2>Project invite links</h2><p>{selected?`${links.length} links for ${selected.name}`:'Select a project to see its links'}</p></div></div>
      {links.map(link=><div className="connect-link-card" key={link.inviteId}><div className="connect-qr"><QRCodeSVG value={link.url} size={172} level="M" includeMargin/></div><div className="connect-link-details"><Badge tone="violet">{link.maxUses===null?'Unlimited users':`Up to ${link.maxUses} users`}</Badge><b>Scan to open {selected?.name}</b><small>Created {new Date(link.createdAt).toLocaleString()}</small>{link.maxUses===null&&<small>Never expires</small>}<input readOnly value={link.url} aria-label="Project invite URL"/><div className="connect-link-actions"><Button onClick={()=>void navigator.clipboard.writeText(link.url).then(()=>setMessage('Invite link copied.'))}><Copy size={14}/> Copy link</Button><Button className="danger-button" disabled={busy||sharedProjectRoles[selected?.id||0]==='member'} onClick={async()=>{setBusy(true);try{await onRevokeLink(selected!.id,link.inviteId);setMessage('Invite link revoked.')}catch(error){setMessage(error instanceof Error?error.message:'Could not revoke link.')}finally{setBusy(false)}}}><Trash2 size={14}/> Revoke</Button></div></div></div>)}
      {selected&&links.length===0&&<div className="connect-empty"><Link2 size={20}/><b>No invite links yet</b><small>Create a link to share this project with collaborators.</small></div>}
    </Card></div>
  </>
}

function DatabasePage({ databases, onAdd, onDisconnect }: { databases:DatabaseDraft[]; onAdd:(database:DatabaseDraft)=>void; onDisconnect:(id:number)=>void }) {
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({name:'',provider:'PostgreSQL'})
  const [supabaseStatus,setSupabaseStatus]=useState<'checking'|'connected'|'table-missing'|'offline'>('checking')
  useEffect(()=>{
    if(!import.meta.env.VITE_SUPABASE_URL||!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY){setSupabaseStatus('offline');return}
    supabase.from('flowcast').select('id').limit(1).then(({error})=>{
      if(!error)setSupabaseStatus('connected')
      else if(error.code==='42P01'||error.code==='PGRST205'||error.message.toLowerCase().includes('flowcast'))setSupabaseStatus('table-missing')
      else setSupabaseStatus('offline')
    })
  },[])
  const statusLabel=supabaseStatus==='checking'?'Checking Supabase…':supabaseStatus==='connected'?'Connected to Supabase · flowcast table ready':supabaseStatus==='table-missing'?'Supabase reachable · flowcast table needs setup':'Could not reach Supabase'
  const statusDetail=supabaseStatus==='connected'?'The Flowcast project table is responding.':supabaseStatus==='table-missing'?'Add the flowcast table in your Supabase project before saving shared projects.':supabaseStatus==='offline'?'Check the local VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY settings.':'Testing the Supabase project connection.'
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(!form.name.trim())return;onAdd({id:Date.now(),name:form.name.trim(),provider:form.provider,status:'Draft'});setForm({name:'',provider:'PostgreSQL'});setShowAdd(false)}
  return <><div className="page-heading"><div><p className="eyebrow">Simple connections</p><h1>Database</h1><p>Supabase connection for the Flowcast workspace.</p></div><Button className="primary" onClick={()=>setShowAdd(true)}><CirclePlus size={16}/> Other database</Button></div><Card className="database-alert"><span className={`dot ${supabaseStatus==='connected'?'dot-connected':''}`}/><div><b>{statusLabel}</b><small>{statusDetail}</small></div></Card><div className="database-steps"><span><b>1</b><small>Connect Supabase</small></span><i/><span><b>2</b><small>Create flowcast table</small></span><i/><span><b>3</b><small>Share projects</small></span></div><div className="database-grid"><Card className="database-card featured"><div className="database-logo"><Zap size={21}/></div><div><Badge tone="violet">Supabase</Badge><h3>Flowcast workspace</h3><p>Your Supabase project is configured in the local environment.</p></div><ol><li>Connection health is checked when this page opens</li><li>Table access is protected by row-level security</li><li>Invite access is limited to project members</li></ol><Button onClick={()=>{setSupabaseStatus('checking');supabase.from('flowcast').select('id').limit(1).then(({error})=>setSupabaseStatus(!error?'connected':error.code==='42P01'||error.code==='PGRST205'?'table-missing':'offline'))}}>Check connection</Button></Card>{databases.map(database=><Card className="database-card" key={database.id}><div className="database-card-top"><span className="database-logo"><Database size={20}/></span><Badge tone="orange">{database.status}</Badge></div><h3>{database.name}</h3><p>{database.provider} · Waiting for a secure connection.</p><Button className="danger-button full" onClick={()=>onDisconnect(database.id)}>Remove connection</Button></Card>)}</div>{showAdd&&<div className="modal-layer"><div className="modal worker-modal"><div className="modal-head"><div><span className="modal-icon"><Database size={19}/></span><div><p className="eyebrow">Step 1 of 3</p><h2>Choose another database</h2></div></div><Button className="icon-button" onClick={()=>setShowAdd(false)}><X size={18}/></Button></div><p className="modal-intro">Choose the provider now. Credentials are added later through a secure connection.</p><form onSubmit={submit}><label className="field field-full"><span>Connection name</span><input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Production database"/></label><label className="field field-full"><span>Provider</span><select value={form.provider} onChange={event=>setForm({...form,provider:event.target.value})}><option>PostgreSQL</option><option>MySQL</option><option>MongoDB</option><option>Firebase</option><option>Other</option></select></label><div className="modal-actions"><Button type="button" onClick={()=>setShowAdd(false)}>Cancel</Button><Button type="submit" className="primary">Continue</Button></div></form></div></div>}</>
}

function StoragePlansModal({ onClose, onSelect }: { onClose:()=>void; onSelect:(plan:string)=>void }) {
  const plans=[{name:'3 months',price:'₹999',storage:'100 GB'},{name:'6 months',price:'₹1,799',storage:'250 GB',popular:true},{name:'Yearly',price:'₹2,999',storage:'1 TB'}]
  return <div className="modal-layer" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="modal storage-modal"><div className="modal-head"><div><span className="modal-icon"><CreditCard size={20}/></span><div><p className="eyebrow">Flowcast storage</p><h2>Upgrade your workspace</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div><p className="modal-intro">Choose a secure storage pack for project files, thumbnails, and video assets.</p><div className="storage-plans">{plans.map(plan=><div className={`storage-plan ${plan.popular?'popular':''}`} key={plan.name}>{plan.popular&&<Badge tone="violet">Best value</Badge>}<small>{plan.name}</small><strong>{plan.price}</strong><span>{plan.storage} storage</span><Button className={plan.popular?'primary':''} onClick={()=>onSelect(plan.name)}>Choose plan</Button></div>)}</div><p className="pricing-note">Prices include applicable taxes. Payment integration is not connected yet.</p></div></div>
}

function PaymentQRModal({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [seconds,setSeconds]=useState(30)
  useEffect(()=>{
    const timer=window.setInterval(()=>setSeconds(current=>current-1),1000)
    const expiry=window.setTimeout(onClose,30000)
    return()=>{window.clearInterval(timer);window.clearTimeout(expiry)}
  },[onClose])
  const qr=Array.from({length:225},(_,index)=>((index*17+index%7*11+Math.floor(index/15)*5)%9)<4)
  return <div className="modal-layer" role="presentation"><div className="modal qr-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="modal-icon"><CreditCard size={20}/></span><div><p className="eyebrow">Secure checkout preview</p><h2>Scan to continue</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div><div className="qr-content"><Badge tone="violet">{plan} plan</Badge><div className="qr-frame">{qr.map((filled,index)=><i className={filled?'filled':''} key={index}/>)}</div><div className="qr-timer"><Clock3 size={15}/><span>QR expires in</span><strong>00:{String(Math.max(0,seconds)).padStart(2,'0')}</strong></div><p>Payment preview only. A verified payment gateway must be connected before accepting real payments.</p><Button className="full danger-button" onClick={onClose}>Cancel payment</Button></div></div></div>
}

function ProjectsPage({ projects, workers, socialMetrics, onCreate, onDelete, onActivate, onUpdateWorker, canDeleteProject, openProjectId, onJoinedProjectOpened }: { projects: Project[]; workers: Worker[]; socialMetrics: SocialMetric[]; onCreate: () => void; onDelete: (project: Project) => void; onActivate: (project: Project) => void; onUpdateWorker: (worker: Worker) => void; canDeleteProject:(project:Project)=>boolean; openProjectId:number|null; onJoinedProjectOpened:()=>void }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const getProgress=(project:Project)=>{
    const projectWorkers=workers.filter(worker=>worker.projectId===project.id)
    if(!projectWorkers.length)return Math.max(0,Math.min(100,Math.round(project.progress||0)))
    return Math.max(0,Math.min(100,Math.round(projectWorkers.reduce((sum,worker)=>sum+(worker.tasks?worker.done/worker.tasks*100:0),0)/projectWorkers.length)))
  }
  useEffect(()=>{
    if(openProjectId===null)return
    const joinedProject=projects.find(project=>project.id===openProjectId)
    if(!joinedProject)return
    setSelectedProject(joinedProject)
    onJoinedProjectOpened()
  },[openProjectId,projects])
  if (selectedProject) return <ProjectOverview project={selectedProject} workers={workers.filter(worker=>worker.projectId===selectedProject.id)} socialMetrics={socialMetrics.filter(metric=>metric.projectId===selectedProject.id)} onUpdateWorker={onUpdateWorker} onBack={()=>setSelectedProject(null)} canDelete={canDeleteProject(selectedProject)} onDelete={()=>{onDelete(selectedProject);setSelectedProject(null)}}/>
  return <><div className="page-heading"><div><p className="eyebrow">Your workspace</p><h1>Projects</h1><p>Only projects created by you appear here.</p></div><Button className="primary" onClick={onCreate}><CirclePlus size={17}/> New project</Button></div>
    <div className="project-grid">{projects.map(project=>{const progress=getProgress(project);return <Card className="project-card clickable" key={project.id}><div onClick={()=>{onActivate(project);setSelectedProject(project)}} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'){onActivate(project);setSelectedProject(project)}}}><div className="project-card-head"><span className="project-icon"><FolderKanban size={19}/></span><div className="member-actions"><Badge tone={project.priority === 'High' ? 'orange' : 'violet'}>{project.priority}</Badge><button className="delete-icon" disabled={!canDeleteProject(project)} title={canDeleteProject(project)?'Delete project':'Only the project owner can delete this project'} onClick={event=>{event.stopPropagation();onDelete(project)}} aria-label={`Delete ${project.name}`}><Trash2 size={14}/></button></div></div><h3>{project.name}</h3><p>{project.description}</p><div className="project-meta"><span><small>Owner</small><b>{project.owner || 'Unassigned'}</b></span><span><small>Deadline</small><b>{new Date(`${project.deadline}T00:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</b></span></div><div className="project-progress"><span><b>Progress</b><strong className="progress-value">{progress}%</strong></span><div className="progress" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{width:`${progress}%`}}/></div></div></div></Card>})}</div>
    {projects.length===0&&<Card className="team-empty"><FolderKanban size={24}/><b>No projects yet</b><small>Create your first project to start production.</small><Button className="primary" onClick={onCreate}><CirclePlus size={15}/> Create project</Button></Card>}
  </>
}

function ProjectOverview({ project, workers, socialMetrics, onUpdateWorker, onBack, onDelete, canDelete }: { project: Project; workers: Worker[]; socialMetrics: SocialMetric[]; onUpdateWorker: (worker: Worker) => void; onBack: () => void; onDelete: () => void; canDelete:boolean }) {
  const [selectedWorkerId,setSelectedWorkerId]=useState<number|null>(null)
  const selectedWorker=workers.find(worker=>worker.id===selectedWorkerId)||null
  const teamProgress=workers.length?Math.round(workers.reduce((sum,worker)=>sum+(worker.tasks?worker.done/worker.tasks*100:0),0)/workers.length):0
  const socialReach=socialMetrics.reduce((sum,item)=>sum+item.reach,0)
  const socialViews=socialMetrics.reduce((sum,item)=>sum+item.views,0)
  const socialInteractions=socialMetrics.reduce((sum,item)=>sum+item.likes+item.comments+item.shares+item.saves,0)
  return <><div className="project-overview-top"><Button onClick={onBack}><ArrowLeft size={16}/> All projects</Button>{canDelete&&<Button className="danger-button" onClick={onDelete}><Trash2 size={15}/> Delete project</Button>}</div>
    <div className="page-heading project-title"><div><p className="eyebrow">{project.type} · {project.priority} priority</p><h1>{project.name}</h1><p>{project.description}</p></div><Badge tone="green">Active</Badge></div>
    <div className="kpi-grid project-kpis"><Card><small>Project owner</small><b>{project.owner || 'Unassigned'}</b></Card><Card><small>Deadline</small><b>{new Date(`${project.deadline}T00:00:00`).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</b></Card><Card><small>Team progress</small><b>{teamProgress}%</b></Card><Card><small>Team members</small><b>{workers.length}</b></Card></div>
    <Card className="project-social-strip"><div><small>Social content</small><b>{socialMetrics.length}</b></div><div><small>Total reach</small><b>{socialReach.toLocaleString()}</b></div><div><small>Total views</small><b>{socialViews.toLocaleString()}</b></div><div><small>Interactions</small><b>{socialInteractions.toLocaleString()}</b></div></Card>
    <div className="dashboard-grid"><Card className="content-card wide"><div className="card-head"><div><h2>Project team</h2><p>Live task progress for this project</p></div></div><div className="table-wrap"><table><thead><tr><th>Member</th><th>Role</th><th>Stage</th><th>Progress</th></tr></thead><tbody>{workers.map(worker=><tr className="pipeline-row" key={worker.id} onClick={()=>setSelectedWorkerId(worker.id)}><td><b>{worker.name}</b></td><td>{worker.role}</td><td><Badge tone="violet">{worker.stage}</Badge></td><td>{worker.tasks?Math.round(worker.done/worker.tasks*100):0}%</td></tr>)}</tbody></table>{workers.length===0&&<div className="pipeline-empty"><Users size={20}/><div><b>No team assigned</b><small>Add members from Team Management.</small></div></div>}</div></Card><Card className="tasks-card"><div className="card-head"><div><h2>Project summary</h2><p>Current production health</p></div></div><div className="project-summary-progress"><strong>{teamProgress}%</strong><span>team completed</span><div className="progress"><i style={{width:`${teamProgress}%`}}/></div></div><div className="summary-list"><span><i className="purple"/>In production <b>{workers.filter(w=>w.done>0&&w.done<w.tasks).length}</b></span><span><i className="cyan"/>Completed <b>{workers.filter(w=>w.done===w.tasks).length}</b></span><span><i className="amber"/>Not started <b>{workers.filter(w=>w.done===0).length}</b></span></div></Card></div>
    {selectedWorker&&<WorkerPerformanceModal worker={selectedWorker} onClose={()=>setSelectedWorkerId(null)} onUpdate={onUpdateWorker}/>}
  </>
}

function Placeholder({ page }: { page: Page }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={28}/></div><h1>{page}</h1><p>This module is ready for Supabase connection. The dashboard navigation and responsive application shell are in place.</p><Button className="primary">Return to overview</Button></div>
}

const noticeIcon = (kind: Notice['kind']) => kind === 'urgent' ? <AlertTriangle size={16}/> : kind === 'performance' ? <TrendingUp size={16}/> : kind === 'approval' ? <Check size={16}/> : <FileText size={16}/>

function NotificationsPanel({ notices, onRead, onReadAll, onViewAll }: { notices: Notice[]; onRead: (id: number) => void; onReadAll: () => void; onViewAll: () => void }) {
  const unread = notices.filter(notice => !notice.read).length
  return <div className="notifications-panel">
    <div className="notifications-head"><div><h3>Notifications</h3><p>{unread ? `${unread} important updates` : 'You’re all caught up'}</p></div>{unread > 0 && <button onClick={onReadAll}>Mark all read</button>}</div>
    <div className="notifications-list">{notices.slice(0,4).map(notice=><button className={`notice ${notice.read ? 'read' : ''}`} key={notice.id} onClick={()=>onRead(notice.id)}><span className={`notice-icon ${notice.kind}`}>{noticeIcon(notice.kind)}</span><span className="notice-copy"><b>{notice.title}</b><small>{notice.detail}</small><i>{notice.time}</i></span>{!notice.read&&<span className="unread-dot"/>}</button>)}</div>
    <button className="view-all-notices" onClick={onViewAll}>View all notifications <span>→</span></button>
  </div>
}

function NotificationsPage({ notices, onRead, onReadAll }: { notices: Notice[]; onRead: (id: number) => void; onReadAll: () => void }) {
  const unread = notices.filter(notice=>!notice.read).length
  return <><div className="page-heading"><div><p className="eyebrow">Inbox</p><h1>Notifications</h1><p>Important production updates, approvals, and performance alerts.</p></div>{unread > 0&&<Button onClick={onReadAll}><Check size={16}/> Mark all as read</Button>}</div>
    <div className="notification-summary"><Card><span className="notice-icon urgent"><AlertTriangle size={17}/></span><div><b>{notices.filter(n=>n.kind==='urgent'&&!n.read).length}</b><small>Action required</small></div></Card><Card><span className="notice-icon approval"><Check size={17}/></span><div><b>{notices.filter(n=>n.kind==='approval').length}</b><small>Approval updates</small></div></Card><Card><span className="notice-icon performance"><TrendingUp size={17}/></span><div><b>{notices.filter(n=>n.kind==='performance').length}</b><small>Performance alerts</small></div></Card></div>
    <Card className="notifications-page-list"><div className="card-head"><div><h2>Important updates</h2><p>Newest notifications appear first</p></div><Badge tone={unread ? 'orange' : 'green'}>{unread} unread</Badge></div>{notices.map(notice=><button className={`notice page-notice ${notice.read?'read':''}`} key={notice.id} onClick={()=>onRead(notice.id)}><span className={`notice-icon ${notice.kind}`}>{noticeIcon(notice.kind)}</span><span className="notice-copy"><b>{notice.title}</b><small>{notice.detail}</small><i>{notice.time}</i></span>{!notice.read&&<Badge tone="violet">New</Badge>}</button>)}</Card>
  </>
}

function CreateProjectModal({ onClose, onCreate, workers }: { onClose: () => void; onCreate: (project: Project) => void; workers: Worker[] }) {
  const [form, setForm] = useState({ name: '', client: '', owner: '', type: 'Campaign', deadline: '', priority: 'Medium', description: '' })
  const [error, setError] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.deadline) {
      setError('Project name and deadline are required.')
      return
    }
    onCreate({ ...form, id: Date.now(), name: form.name.trim(), client: form.client.trim() || 'Internal project', description: form.description.trim() || 'No project description added yet.', progress: 0 })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
      <div className="modal-head"><div><span className="modal-icon"><FolderKanban size={20}/></span><div><p className="eyebrow">New workspace</p><h2 id="new-project-title">Create a project</h2></div></div><Button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></Button></div>
      <p className="modal-intro">Set up the project essentials. You can add content, tasks, files, and collaborators afterward.</p>
      <form onSubmit={submit}>
        <label className="field field-full"><span>Project name <i>Required</i></span><input autoFocus value={form.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. Summer product launch"/></label>
        <div className="form-grid">
          <label className="field"><span>Client or brand</span><input value={form.client} onChange={e=>update('client',e.target.value)} placeholder="Internal project"/></label>
          <label className="field"><span>Project type</span><select value={form.type} onChange={e=>update('type',e.target.value)}><option>Campaign</option><option>Social series</option><option>Video production</option><option>Content calendar</option><option>Other</option></select></label>
          <label className="field"><span>Project owner</span><input list="project-owner-options" value={form.owner} onChange={e=>update('owner',e.target.value)} placeholder="Type an owner name"/><datalist id="project-owner-options">{workers.map(member=><option key={member.id} value={member.name}>{member.role}</option>)}</datalist><small className="field-help">Choose a team member or enter a custom owner.</small></label>
          <label className="field"><span>Deadline <i>Required</i></span><input type="date" value={form.deadline} onChange={e=>update('deadline',e.target.value)}/></label>
          <label className="field field-full"><span>Priority</span><div className="priority-options">{['Low','Medium','High'].map(priority=><button type="button" key={priority} className={form.priority===priority?'active':''} onClick={()=>update('priority',priority)}>{priority}</button>)}</div></label>
          <label className="field field-full"><span>Project brief</span><textarea value={form.description} onChange={e=>update('description',e.target.value)} placeholder="What is this project trying to achieve?"/></label>
        </div>
        {error&&<div className="form-error">{error}</div>}
        <div className="modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary"><FolderKanban size={16}/> Create project</Button></div>
      </form>
    </div>
  </div>
}

function ProfileModal({ name, role, image, onClose, onSave }: { name: string; role: string; image?: string; onClose: () => void; onSave: (name: string, role: string, image?: string) => void }) {
  const [profileName, setProfileName] = useState(name)
  const [profileRole, setProfileRole] = useState(role)
  const [profileImage, setProfileImage] = useState(image)
  const [error, setError] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!profileName.trim()) return setError('Please enter your name.')
    onSave(profileName.trim(), profileRole.trim() || 'Team member', profileImage)
  }
  return <div className="modal-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="modal-head"><div><span className="modal-icon"><Users size={20}/></span><div><p className="eyebrow">Your identity</p><h2 id="profile-title">Set up your profile</h2></div></div><Button className="icon-button" onClick={onClose}><X size={18}/></Button></div>
      <p className="modal-intro">Choose the name and role shown throughout this workspace.</p>
      <form onSubmit={submit}>
        <div className="profile-photo-row"><Avatar initials={(profileName.slice(0,2)||'WU').toUpperCase()} image={profileImage}/><label className="photo-upload"><Upload size={15}/> Upload profile photo<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)setProfileImage(URL.createObjectURL(file))}}/></label></div>
        <label className="field field-full"><span>Your name <i>Required</i></span><input autoFocus value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Enter your full name"/></label>
        <label className="field field-full"><span>Your role</span><input value={profileRole} onChange={e=>setProfileRole(e.target.value)} placeholder="e.g. Content Director"/></label>
        {error&&<div className="form-error">{error}</div>}
        <div className="modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary"><Check size={16}/> Save profile</Button></div>
      </form>
    </div>
  </div>
}

export default function App() {
  const [supabaseUserId,setSupabaseUserId]=useState<string|null>(null)
  const [supabaseSessionReady,setSupabaseSessionReady]=useState(false)
  const [supabaseSessionError,setSupabaseSessionError]=useState('')
  useEffect(() => {
    let active=true
    const startAnonymousSession=async()=>{
      const {data,error}=await supabase.auth.getSession()
      if(error){if(active){setSupabaseSessionError(error.message);setSupabaseSessionReady(true)}return}
      if(data.session?.user){if(active){setSupabaseUserId(data.session.user.id);setSupabaseSessionReady(true)}return}
      const {data:anonymousData,error:anonymousError}=await supabase.auth.signInAnonymously()
      if(!active)return
      if(anonymousError){setSupabaseSessionError(anonymousError.message);setSupabaseSessionReady(true);return}
      setSupabaseUserId(anonymousData.user?.id||null);setSupabaseSessionReady(true)
    }
    void startAnonymousSession()
    return ()=>{active=false}
  }, [])
  
  const [page, setPage] = useState<Page>('Overview')
  const [range, setRange] = useState<Range>('7 days')
  const [dark, setDark] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [toast, setToast] = useState('')
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<{name:string;role:string;image?:string}>({ name: '', role: '' })
  const [workers, setWorkers] = useState<Worker[]>(initialTeam)
  const [starterWorkers,setStarterWorkers]=useState<Worker[]>(demoTeam)
  const [storageOpen,setStorageOpen]=useState(false)
  const [paymentPlan,setPaymentPlan]=useState('')
  const [activeProjectId,setActiveProjectId]=useState<number|null>(null)
  const [analytics,setAnalytics]=useState<Record<number,AnalyticsData>>({})
  const [socialMetrics,setSocialMetrics]=useState<SocialMetric[]>([])
  const [reports,setReports]=useState<WorkspaceReport[]>([])
  const [databases,setDatabases]=useState<DatabaseDraft[]>([])
  const [apiConnections,setApiConnections]=useState<Record<number,string[]>>({})
  const [remoteProjectIds,setRemoteProjectIds]=useState<Record<number,string>>({})
  const [sharedProjectRoles,setSharedProjectRoles]=useState<Record<number,'owner'|'member'>>({})
  const [shareLinks,setShareLinks]=useState<Record<number,ShareLink[]>>({})
  const syncedProjectSnapshots=useRef<Record<string,string>>({})
  const [sharedSyncError,setSharedSyncError]=useState('')
  const [shareJoinError,setShareJoinError]=useState('')
  const [openJoinedProjectId,setOpenJoinedProjectId]=useState<number|null>(null)
  const joinInviteAttempted=useRef(false)
  const [localStorageReady,setLocalStorageReady]=useState(false)
  const [workspaceSaveError,setWorkspaceSaveError]=useState('')
  useEffect(()=>{
    try{
      const raw=window.localStorage.getItem('flowcast.workspace.v1')
      if(raw){
        const saved=JSON.parse(raw) as Record<string,any>
        if(Array.isArray(saved.projects))setProjects(saved.projects)
        if(Array.isArray(saved.workers))setWorkers(saved.workers)
        if(Array.isArray(saved.starterWorkers))setStarterWorkers(saved.starterWorkers)
        if(saved.profile)setProfile(saved.profile)
        if(saved.analytics)setAnalytics(saved.analytics)
        if(Array.isArray(saved.socialMetrics))setSocialMetrics(saved.socialMetrics)
        if(Array.isArray(saved.reports))setReports(saved.reports)
        if(Array.isArray(saved.databases))setDatabases(saved.databases)
        if(saved.apiConnections)setApiConnections(saved.apiConnections)
        if(saved.remoteProjectIds)setRemoteProjectIds(saved.remoteProjectIds)
        if(saved.sharedProjectRoles)setSharedProjectRoles(saved.sharedProjectRoles)
        if(saved.shareLinks)setShareLinks(saved.shareLinks)
        if(Array.isArray(saved.notices))setNotices(saved.notices)
        if(typeof saved.dark==='boolean')setDark(saved.dark)
        if(saved.range)setRange(saved.range)
      }
    }catch(error){console.error('Could not restore the saved Flowcast workspace:',error)}
    setLocalStorageReady(true)
  },[])
  useEffect(()=>{
    const inviteToken=new URLSearchParams(window.location.search).get('join')
    if(!inviteToken||!localStorageReady||!supabaseSessionReady||!supabaseUserId||joinInviteAttempted.current)return
    joinInviteAttempted.current=true
    const joinProject=async()=>{
      setShareJoinError('')
      const {data:joinedId,error:joinError}=await supabase.rpc('redeem_flowcast_invite',{p_token_hash:await hashShareToken(inviteToken)})
      if(joinError){setShareJoinError(joinError.message);setToast(`Could not join project: ${joinError.message}`);return}
      const {data:row,error:readError}=await supabase.from('flowcast').select('id,owner_id,name,details,updated_at').eq('id',joinedId).single()
      if(readError||!row){const message=readError?.message||'Project could not be loaded.';setShareJoinError(message);setToast(`Could not open project: ${message}`);return}
      const snapshot=row.details as ProjectShareSnapshot
      if(!snapshot?.project){const message='This invite does not contain a valid project.';setShareJoinError(message);setToast(message);return}
      const currentMapping=Object.entries(remoteProjectIds).find(([,remoteId])=>remoteId===row.id)
      const localId=currentMapping?Number(currentMapping[0]):Date.now()+Math.floor(Math.random()*10000)
      syncedProjectSnapshots.current[row.id]=JSON.stringify(snapshot)
      setProjects(current=>current.some(project=>project.id===localId)?current.map(project=>project.id===localId?{...snapshot.project,id:localId}:project):[{...snapshot.project,id:localId},...current])
      setWorkers(current=>[...current.filter(worker=>worker.projectId!==localId),...(snapshot.workers||[]).map(worker=>({...worker,projectId:localId}))])
      setSocialMetrics(current=>[...current.filter(metric=>metric.projectId!==localId),...(snapshot.socialMetrics||[]).map(metric=>({...metric,projectId:localId}))])
      setAnalytics(current=>{const next={...current};if(snapshot.analytics)next[localId]=snapshot.analytics;else delete next[localId];return next})
      setReports(snapshot.reports||[])
      setApiConnections(current=>({...current,[localId]:snapshot.apiConnections||[]}))
      setRemoteProjectIds(current=>({...current,[localId]:row.id}))
      setSharedProjectRoles(current=>({...current,[localId]:row.owner_id===supabaseUserId?'owner':'member'}))
      setActiveProjectId(localId);setOpenJoinedProjectId(localId);setPage('Projects');setToast(`${row.name} is now connected`)
      const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('join');window.history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash)
    }
    void joinProject()
  },[localStorageReady,supabaseSessionReady,supabaseUserId])
  useEffect(()=>{
    if(!localStorageReady)return
    const snapshot={projects,workers,starterWorkers,profile,activeProjectId,analytics,socialMetrics,reports,databases,apiConnections,remoteProjectIds,sharedProjectRoles,shareLinks,notices,dark,range}
    try{window.localStorage.setItem('flowcast.workspace.v1',JSON.stringify(snapshot));setWorkspaceSaveError('')}
    catch(error){setWorkspaceSaveError(error instanceof Error?error.message:'Browser storage is full')}
  },[localStorageReady,projects,workers,starterWorkers,profile,activeProjectId,analytics,socialMetrics,reports,databases,apiConnections,remoteProjectIds,sharedProjectRoles,shareLinks,notices,dark,range])
  useEffect(()=>{
    if(!localStorageReady||!supabaseSessionReady||!supabaseUserId||Object.keys(remoteProjectIds).length===0)return
    const timer=window.setTimeout(async()=>{
      const updates=await Promise.all(Object.entries(remoteProjectIds).map(async([localId,remoteId])=>{
        const project=projects.find(item=>item.id===Number(localId))
        if(!project)return null
        const details=makeProjectShareSnapshot(project,workers,socialMetrics,analytics,reports,apiConnections)
        const detailsKey=JSON.stringify(details)
        if(!Object.prototype.hasOwnProperty.call(syncedProjectSnapshots.current,remoteId))return null
        if(syncedProjectSnapshots.current[remoteId]===detailsKey)return null
        const {error}=await supabase.from('flowcast').update({name:project.name,details,updated_at:new Date().toISOString()}).eq('id',remoteId)
        if(!error)syncedProjectSnapshots.current[remoteId]=detailsKey
        return error?.message||null
      }))
      const firstError=updates.find(Boolean)
      setSharedSyncError(firstError||'')
    },600)
    return ()=>window.clearTimeout(timer)
  },[localStorageReady,supabaseSessionReady,supabaseUserId,remoteProjectIds,projects,workers,socialMetrics,analytics,reports,apiConnections])
  useEffect(()=>{
    if(!localStorageReady||!supabaseSessionReady||!supabaseUserId||Object.keys(remoteProjectIds).length===0)return
    let active=true
    const pullSharedProjects=async()=>{
      const entries=Object.entries(remoteProjectIds)
      if(!entries.length)return
      const {data,error}=await supabase.from('flowcast').select('id,details').in('id',entries.map(([,remoteId])=>remoteId))
      if(!active)return
      if(error){setSharedSyncError(error.message);return}
      for(const [localIdValue,remoteId] of entries){
        const row=data?.find(item=>item.id===remoteId)
        const snapshot=row?.details as ProjectShareSnapshot|undefined
        if(!snapshot?.project)continue
        const remoteKey=JSON.stringify(snapshot)
        const localId=Number(localIdValue)
        const currentProject=projects.find(project=>project.id===localId)
        const localKey=currentProject?JSON.stringify(makeProjectShareSnapshot(currentProject,workers,socialMetrics,analytics,reports,apiConnections)):''
        const knownKey=syncedProjectSnapshots.current[remoteId]
        if(knownKey&&remoteKey!==knownKey&&localKey!==knownKey)continue
        if(remoteKey===knownKey)continue
        syncedProjectSnapshots.current[remoteId]=remoteKey
        setProjects(current=>current.map(project=>project.id===localId?{...snapshot.project,id:localId}:project))
        setWorkers(current=>[...current.filter(worker=>worker.projectId!==localId),...(snapshot.workers||[]).map(worker=>({...worker,projectId:localId}))])
        setSocialMetrics(current=>[...current.filter(metric=>metric.projectId!==localId),...(snapshot.socialMetrics||[]).map(metric=>({...metric,projectId:localId}))])
        setAnalytics(current=>{const next={...current};if(snapshot.analytics)next[localId]=snapshot.analytics;else delete next[localId];return next})
        setReports(snapshot.reports||[])
        setApiConnections(current=>({...current,[localId]:snapshot.apiConnections||[]}))
      }
      setSharedSyncError('')
    }
    void pullSharedProjects()
    const timer=window.setInterval(()=>void pullSharedProjects(),2000)
    return()=>{active=false;window.clearInterval(timer)}
  },[localStorageReady,supabaseSessionReady,supabaseUserId,remoteProjectIds,projects,workers,socialMetrics,analytics,reports,apiConnections])
  const searchResults = useMemo(() => search ? [...content.map(x=>x.title), ...workers.map(x=>x.name)].filter(x=>x.toLowerCase().includes(search.toLowerCase())).slice(0,5) : [], [search, workers])
  const createProject = (project: Project) => {
    setProjects(current => [project, ...current])
    setActiveProjectId(project.id)
    setCreateOpen(false)
    setPage('Overview')
    setToast(`${project.name} was created`)
  }
  const unreadCount = notices.filter(notice => !notice.read).length
  const nameParts = profile.name.trim().split(/\s+/).filter(Boolean)
  const profileInitials = (nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[1][0]}` : nameParts[0]?.slice(0, 2) || 'U').toUpperCase()
  const markRead = (id: number) => setNotices(current => current.map(notice => notice.id === id ? {...notice, read: true} : notice))
  const markAllRead = () => setNotices(current => current.map(notice => ({...notice, read: true})))
  const updateWorker = (updated: Worker) => setWorkers(current=>current.map(worker=>worker.id===updated.id?updated:worker))
  const activeProject=projects.find(project=>project.id===activeProjectId)
  const activeWorkers=workers.filter(worker=>worker.projectId===activeProjectId)
  const activeSocialMetrics=socialMetrics.filter(metric=>metric.projectId===activeProjectId)
  const createProjectShareLink=async(projectId:number,maxUses:number|null)=>{
    if(!supabaseSessionReady||!supabaseUserId)throw new Error(supabaseSessionError||'Supabase anonymous access is unavailable.')
    const project=projects.find(item=>item.id===projectId)
    if(!project)throw new Error('Choose a project before creating an invite.')
    let remoteId=remoteProjectIds[projectId]
    if(sharedProjectRoles[projectId]==='member')throw new Error('Only the project owner can create invites.')
    const details=makeProjectShareSnapshot(project,workers,socialMetrics,analytics,reports,apiConnections)
    if(remoteId){
      const {error}=await supabase.from('flowcast').update({name:project.name,details,updated_at:new Date().toISOString()}).eq('id',remoteId)
      if(error)throw new Error(error.message)
    }else{
      const {data,error}=await supabase.from('flowcast').insert({owner_id:supabaseUserId,name:project.name,details}).select('id').single()
      if(error)throw new Error(error.message)
      remoteId=data.id
      syncedProjectSnapshots.current[remoteId]=JSON.stringify(details)
      setRemoteProjectIds(current=>({...current,[projectId]:remoteId!}))
      setSharedProjectRoles(current=>({...current,[projectId]:'owner'}))
    }
    const existingLink=shareLinks[projectId]?.[0]
    if(existingLink){
      const {error}=await supabase.from('flowcast_invites').update({max_uses:maxUses,expires_at:null}).eq('id',existingLink.inviteId)
      if(error)throw new Error(error.message)
      const shareBase=getShareBaseUrl()
      const url=new URL(window.location.pathname,shareBase)
      url.searchParams.set('join',new URL(existingLink.url,window.location.origin).searchParams.get('join')||'')
      setShareLinks(current=>({...current,[projectId]:(current[projectId]||[]).map(link=>link.inviteId===existingLink.inviteId?{...link,url:url.toString(),maxUses}:link)}))
      return
    }
    const token=randomShareToken()
    const tokenHash=await hashShareToken(token)
    const expiresAt=null
    const {data:invite,error:inviteError}=await supabase.from('flowcast_invites').insert({flowcast_id:remoteId,created_by:supabaseUserId,token_hash:tokenHash,max_uses:maxUses,expires_at:expiresAt}).select('id').single()
    if(inviteError)throw new Error(inviteError.message)
    const shareBase=getShareBaseUrl()
    const url=new URL(window.location.pathname,shareBase)
    url.searchParams.set('join',token)
    const newLink:ShareLink={inviteId:invite.id,url:url.toString(),createdAt:new Date().toISOString(),maxUses}
    setShareLinks(current=>({...current,[projectId]:[newLink,...(current[projectId]||[])]}))
  }
  const revokeProjectShareLink=async(projectId:number,inviteId:string)=>{
    if(sharedProjectRoles[projectId]==='member')throw new Error('Only the project owner can revoke invites.')
    const {error}=await supabase.from('flowcast_invites').delete().eq('id',inviteId)
    if(error)throw new Error(error.message)
    setShareLinks(current=>({...current,[projectId]:(current[projectId]||[]).filter(link=>link.inviteId!==inviteId)}))
  }
  const deleteProject=async(project:Project)=>{
    if(sharedProjectRoles[project.id]==='member'){setToast('Only the project owner can delete this project.');return}
    const remoteId=remoteProjectIds[project.id]
    if(remoteId){
      const {error}=await supabase.from('flowcast').delete().eq('id',remoteId)
      if(error){setToast(`Could not delete project: ${error.message}`);return}
    }
    setProjects(current=>current.filter(item=>item.id!==project.id))
    setWorkers(current=>current.filter(worker=>worker.projectId!==project.id))
    setSocialMetrics(current=>current.filter(metric=>metric.projectId!==project.id))
    setAnalytics(current=>{const next={...current};delete next[project.id];return next})
    setRemoteProjectIds(current=>{const next={...current};delete next[project.id];return next})
    setSharedProjectRoles(current=>{const next={...current};delete next[project.id];return next})
    setShareLinks(current=>{const next={...current};delete next[project.id];return next})
    if(activeProjectId===project.id)setActiveProjectId(null)
    setToast(`${project.name} was deleted`)
  }
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])
  return <div className={dark ? 'app dark' : 'app'}>
    <aside className={`${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span><Zap size={19}/></span><b>Flowcast</b><Button className="collapse" onClick={()=>setCollapsed(v=>!v)}><Menu size={17}/></Button></div>
      <nav>{nav.map(({label,icon:Icon})=><Button key={label} className={page===label?'selected':''} onClick={()=>{setPage(label);setMobileOpen(false);setNoticesOpen(false)}}><Icon size={18}/><span>{label}</span>{label==='Notifications'&&unreadCount>0&&<i>{unreadCount}</i>}</Button>)}</nav>
      <div className="sidebar-foot"><div className="storage-hover-wrap"><button className="storage storage-button" onClick={()=>setStorageOpen(true)}><span><b>Storage</b><small>68% used · Upgrade</small></span><div><i/></div></button><div className="storage-hover-card"><span className="storage-hover-icon"><Sparkles size={16}/></span><div><b>Upgrade your workspace</b><small>Plans from ₹999 · Up to 1 TB</small></div><span>View →</span></div></div><button className="user profile-button" onClick={()=>setProfileOpen(true)}><Avatar initials={profileInitials} color="violet" image={profile.image}/><span><b>{profile.name||'Set up profile'}</b><small>{profile.role||'Add name and role'}</small></span><MoreHorizontal size={17}/></button></div>
    </aside>
    {mobileOpen && <div className="scrim" onClick={()=>setMobileOpen(false)}/>}
    <main>
      <header><Button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu size={19}/></Button><div className="global-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search anything…"/><kbd>⌘ K</kbd>{searchResults.length>0&&<div className="search-results">{searchResults.map(r=><button key={r} onClick={()=>setSearch('')}><Search size={14}/>{r}</button>)}</div>}</div><div className="header-actions"><span className={`save-status ${workspaceSaveError?'failed':''}`} title={workspaceSaveError||'Saved in this browser'}>{workspaceSaveError?'Storage full':'Saved on this device'}</span><Button className="icon-button" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</Button><div className="notification-wrap"><Button className="icon-button notification" onClick={()=>setNoticesOpen(open=>!open)} aria-label={`Notifications, ${unreadCount} unread`}><Bell size={18}/>{unreadCount>0&&<i/>}</Button>{noticesOpen&&<NotificationsPanel notices={notices} onRead={markRead} onReadAll={markAllRead} onViewAll={()=>{setPage('Notifications');setNoticesOpen(false)}}/>}</div><Button className="primary" onClick={()=>setCreateOpen(true)}><CirclePlus size={17}/><span>Create</span></Button></div></header>
      <div className="page">
        {shareJoinError&&page!=='Connection'&&<Card className="connect-notice connect-error"><AlertTriangle size={18}/><div><b>Could not open this shared project</b><small>{shareJoinError}</small></div></Card>}
        {page==='Overview'&&<Dashboard range={range} setRange={setRange} userName={profile.name} project={activeProject} workers={activeProject?activeWorkers:starterWorkers} socialMetrics={activeProject?activeSocialMetrics:demoSocialMetrics} onGoTeam={()=>setPage('Team')} onUpdateWorker={activeProject?updateWorker:worker=>setStarterWorkers(current=>current.map(item=>item.id===worker.id?worker:item))}/>}
        {page==='Team'&&<TeamPage project={activeProject} starter={!activeProject} workers={activeProject?activeWorkers:starterWorkers} onAdd={worker=>{if(activeProjectId&&activeWorkers.length<20){setWorkers(current=>[{...worker,projectId:activeProjectId},...current]);setToast(`${worker.name} was added to ${activeProject?.name}`)}else if(!activeProject&&starterWorkers.length<20){setStarterWorkers(current=>[worker,...current]);setToast(`${worker.name} was added to the starter team`)}}} onUpdate={worker=>{activeProject?updateWorker(worker):setStarterWorkers(current=>current.map(item=>item.id===worker.id?worker:item));setToast(`${worker.name} was updated`)}} onDelete={worker=>{activeProject?setWorkers(current=>current.filter(item=>item.id!==worker.id)):setStarterWorkers(current=>current.filter(item=>item.id!==worker.id));setToast(`${worker.name} was removed`)}}/>}
        {page==='Projects'&&<ProjectsPage projects={projects} workers={workers} socialMetrics={socialMetrics} onUpdateWorker={updateWorker} onCreate={()=>setCreateOpen(true)} onActivate={project=>setActiveProjectId(project.id)} canDeleteProject={project=>sharedProjectRoles[project.id]!=='member'} onDelete={project=>{void deleteProject(project)}} openProjectId={openJoinedProjectId} onJoinedProjectOpened={()=>setOpenJoinedProjectId(null)}/>}
        {page==='Connection'&&<ConnectDesk projects={projects} activeProjectId={activeProjectId} remoteProjectIds={remoteProjectIds} sharedProjectRoles={sharedProjectRoles} shareLinks={shareLinks} sessionReady={supabaseSessionReady&&!!supabaseUserId} sessionError={supabaseSessionError} syncError={sharedSyncError} joinError={shareJoinError} onCreateLink={createProjectShareLink} onRevokeLink={revokeProjectShareLink}/>}
        {page==='Calendar'&&<ContentCalendar projects={projects}/>}
        {page==='Plugins'&&<PluginsPage project={activeProject} metrics={activeSocialMetrics} onAdd={metric=>{setSocialMetrics(current=>[metric,...current]);setToast(`${metric.title} reach added to Overview`)}}/>}
        {page==='APIs'&&<ApiDesk project={activeProject} connected={activeProjectId?apiConnections[activeProjectId]||[]:[]} onConnect={platform=>{if(!activeProjectId)return;setApiConnections(current=>({...current,[activeProjectId]:Array.from(new Set([...(current[activeProjectId]||[]),platform]))}));setToast(`${platform} setup marked ready`)}} onDisconnect={platform=>{if(!activeProjectId)return;setApiConnections(current=>({...current,[activeProjectId]:(current[activeProjectId]||[]).filter(item=>item!==platform)}));setToast(`${platform} setup status removed`)}}/>}
        {page==='Video analytics'&&<VideoAnalytics projects={projects} activeProjectId={activeProjectId} analytics={analytics} socialMetrics={socialMetrics} onUpdate={(projectId,data)=>setAnalytics(current=>({...current,[projectId]:data}))}/>}
        {page==='Engine'&&<EnginePage project={activeProject} analytics={activeProjectId?analytics[activeProjectId]:undefined}/>}
        {page==='Reports'&&<ReportsPage reports={reports} onAdd={report=>{setReports(current=>[report,...current]);setToast('Report published')}} onDelete={id=>setReports(current=>current.filter(report=>report.id!==id))}/>}
        {page==='Database'&&<DatabasePage databases={databases} onAdd={database=>{setDatabases(current=>current.some(item=>item.name===database.name)?current:[database,...current]);setToast('Database setup record added')}} onDisconnect={id=>{setDatabases(current=>current.filter(database=>database.id!==id));setToast('Database record disconnected')}}/>}
        {page==='Notifications'&&<NotificationsPage notices={notices} onRead={markRead} onReadAll={markAllRead}/>}
        {page==='Settings'&&<SettingsPage profile={profile} onEdit={()=>setProfileOpen(true)}/>}
        {!['Overview','Team','Projects','Connection','Calendar','Plugins','APIs','Video analytics','Engine','Reports','Database','Notifications','Settings'].includes(page)&&<Placeholder page={page}/>}
      </div>
    </main>
    {createOpen&&<CreateProjectModal onClose={()=>setCreateOpen(false)} onCreate={createProject} workers={workers}/>}
    {profileOpen&&<ProfileModal name={profile.name} role={profile.role} image={profile.image} onClose={()=>setProfileOpen(false)} onSave={(name,role,image)=>{setProfile({name,role,image});setProfileOpen(false);setToast('Your profile was updated')}}/>}
    {storageOpen&&<StoragePlansModal onClose={()=>setStorageOpen(false)} onSelect={plan=>{setStorageOpen(false);setPaymentPlan(plan)}}/>}
    {paymentPlan&&<PaymentQRModal plan={paymentPlan} onClose={()=>setPaymentPlan('')}/>}
    {toast&&<div className="toast"><span><Check size={15}/></span><div><b>Success</b><small>{toast}</small></div></div>}
  </div>
}
