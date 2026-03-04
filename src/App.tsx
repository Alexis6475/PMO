import { useState, useEffect, useRef } from 'react';

// ─── Types ───
type Status = 'Not started' | 'In progress' | 'Done';
type Priority = 'P0' | 'P1' | 'P2' | '';
type Stream = 'Control Tower' | 'CRM' | 'iPaaS' | 'Data Hub';

interface Task { id: string; stream: Stream; title: string; owner: string; status: Status; priority: Priority; dueDate: string; description: string; }
interface Note { id: string; title: string; description: string; }
interface Decision { id: string; name: string; date: string; owner: string; description: string; stream?: Stream; decided: boolean; }
interface MeetingNote { id: string; title: string; date: string; content: string; photos?: string[]; }
interface StreamItem { id: string; title: string; owner: string; dueDate: string; description: string; }
interface AppData {
  tasks: Record<string, Task[]>;
  notes: Record<string, Note[]>;
  decisions: Record<string, Decision[]>;
  meetings: Record<string, MeetingNote[]>;
  streamItems: Record<string, { toBeDiscussed: StreamItem[]; potentialRisks: StreamItem[]; }>;
  controlTower: { askVattenfall: StreamItem[]; keyMessages: StreamItem[]; };
}

// ─── Constants ───
const STREAMS: Stream[] = ['Control Tower', 'CRM', 'iPaaS', 'Data Hub'];
const WORK_STREAMS: Stream[] = ['CRM', 'iPaaS', 'Data Hub'];
const STATUSES: Status[] = ['Not started', 'In progress', 'Done'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
const VIEWS = ['Weekly', 'Streams', 'Roadmap', 'Calendar'];
const STORAGE_KEY = 'vattenfall-nova-v5';

// ─── Draft / unsaved items system ───
type DraftKind = 'task' | 'meeting' | 'decision';
interface DraftItem {
  id: string;
  kind: DraftKind;
  stream: Stream;
  label: string;      // short display title
  payload: Record<string, unknown>;  // the partial form data
  savedAt: number;    // timestamp
}
const OWNERS = ['SK', 'VF', 'Komeet', 'Mi4', 'JEMS'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SEED_TASKS: Record<string, Task[]> = { CRM: [], iPaaS: [], 'Data Hub': [], 'Control Tower': [] };


// ─── Roadmap seed data (updated post-merger Mar 2026) ───
interface RoadmapStep { id: string; stream: string; step: string; name: string; start: string; end: string; status: string; isStep: boolean; }
const ROADMAP: RoadmapStep[] = [
  // ── Data Hub ──
  { id:'dh1',   stream:'Data Hub', step:'1',   name:'Audit of existing | Workshops, interviews & interaction mapping', start:'2026-01-12', end:'2026-03-09', status:'In Progress', isStep:true  },
  { id:'dh1.1', stream:'Data Hub', step:'1.1', name:'Document collection and analysis',         start:'2026-01-12', end:'2026-01-26', status:'Done',        isStep:false },
  { id:'dh1.2', stream:'Data Hub', step:'1.2', name:'Interaction mapping',                      start:'2026-02-02', end:'2026-02-16', status:'Done',        isStep:false },
  { id:'dh1.3', stream:'Data Hub', step:'1.3', name:'Business interviews',                      start:'2026-01-26', end:'2026-02-09', status:'Done',        isStep:false },
  { id:'dh1.4', stream:'Data Hub', step:'1.4', name:'Synthesis of business interviews',         start:'2026-02-09', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'dh2',   stream:'Data Hub', step:'2',   name:'Target definition | Target architecture, migration & urbanization strategy', start:'2026-02-09', end:'2026-03-30', status:'In Progress', isStep:true  },
  { id:'dh2.1', stream:'Data Hub', step:'2.1', name:'Co-construction of target architecture',   start:'2026-02-16', end:'2026-03-23', status:'In Progress', isStep:false },
  { id:'dh2.2', stream:'Data Hub', step:'2.2', name:'Construction of urbanization strategy',    start:'2026-02-09', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'dh2.3', stream:'Data Hub', step:'2.3', name:'Definition of migration strategy',         start:'2026-02-09', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'dh2.4', stream:'Data Hub', step:'2.4', name:'Deployment strategy definition',           start:'2026-03-16', end:'2026-03-30', status:'Not started', isStep:false },
  { id:'dh3',   stream:'Data Hub', step:'3',   name:'Roadmap definition | Budget / cost-estimations, 2-years roadmap & action plan', start:'2026-03-16', end:'2026-03-30', status:'Not started', isStep:true  },
  { id:'dh4',   stream:'Data Hub', step:'4',   name:'Data governance | Strategy & governance plan', start:'2026-02-09', end:'2026-03-30', status:'In Progress', isStep:true  },
  { id:'dh4.1', stream:'Data Hub', step:'4.1', name:'Data governance strategy definition',      start:'2026-02-09', end:'2026-03-16', status:'In Progress', isStep:false },
  { id:'dh4.2', stream:'Data Hub', step:'4.2', name:'Governance plan definition',               start:'2026-03-16', end:'2026-03-30', status:'Not started', isStep:false },
  { id:'dh5',   stream:'Data Hub', step:'5',   name:'Platform set-up [PMI]',                    start:'2026-06-08', end:'2026-08-17', status:'Not started', isStep:true  },
  { id:'dh6',   stream:'Data Hub', step:'6',   name:'Data ingestion | High-priority build [PMI – Batch#1]', start:'2026-08-17', end:'2026-11-09', status:'Not started', isStep:true  },
  { id:'dh7',   stream:'Data Hub', step:'7',   name:'Data ingestion | High-priority test & hypercare [PMI – Batch#1]', start:'2026-11-09', end:'2027-01-26', status:'Not started', isStep:true  },
  // ── iPaaS ──
  { id:'ip1',   stream:'iPaaS', step:'1',   name:'Pilot flows – Simple & Medium | Identification, documentation & development', start:'2026-01-19', end:'2026-03-30', status:'In Progress', isStep:true  },
  { id:'ip1.1', stream:'iPaaS', step:'1.1', name:'Identification of 3 pilot dataflows',        start:'2026-01-19', end:'2026-01-26', status:'Done',        isStep:false },
  { id:'ip1.2', stream:'iPaaS', step:'1.2', name:'Conception of the 3 pilot dataflows',        start:'2026-02-02', end:'2026-02-16', status:'Done',        isStep:false },
  { id:'ip1.3', stream:'iPaaS', step:'1.3', name:'Development of simple & medium flows',       start:'2026-02-23', end:'2026-03-30', status:'In Progress', isStep:false },
  { id:'ip2',   stream:'iPaaS', step:'2',   name:'Pilot flows – Complex | Identification, documentation & development [+TBD PMI]', start:'2026-02-23', end:'2026-03-30', status:'In Progress', isStep:true  },
  { id:'ip3',   stream:'iPaaS', step:'3',   name:'Backlog | Identification of dataflows, documentation & prioritization [+TBD PMI]', start:'2026-02-23', end:'2026-03-30', status:'Not started', isStep:true  },
  { id:'ip4',   stream:'iPaaS', step:'4',   name:'Platform set-up',                            start:'2026-02-09', end:'2026-03-09', status:'In Progress', isStep:true  },
  { id:'ip5',   stream:'iPaaS', step:'5',   name:'Platform on-boarding | Workshops [TBC – 3 days]', start:'2026-02-23', end:'2026-03-16', status:'In Progress', isStep:true  },
  // ── CRM ──
  { id:'crm1',  stream:'CRM', step:'1',   name:'Scoping | Workshops',                          start:'2025-12-01', end:'2026-03-09', status:'In Progress', isStep:true  },
  { id:'crm1.1',stream:'CRM', step:'1.1', name:'Scoping workshops',                            start:'2025-12-01', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'crm1.2',stream:'CRM', step:'1.2', name:'Data model definition',                        start:'2025-12-01', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'crm1.3',stream:'CRM', step:'1.3', name:'Business process definition',                  start:'2025-12-01', end:'2026-03-09', status:'In Progress', isStep:false },
  { id:'crm2',  stream:'CRM', step:'2',   name:'Scoping | Detailing documentation',            start:'2026-01-19', end:'2026-03-30', status:'In Progress', isStep:true  },
  { id:'crm3',  stream:'CRM', step:'3',   name:'Development | Interfaces and migration preparation', start:'2026-04-13', end:'2026-10-26', status:'Not started', isStep:true  },
  { id:'crm4',  stream:'CRM', step:'4',   name:'Platform set-up',                              start:'2026-04-13', end:'2026-09-07', status:'Not started', isStep:true  },
  { id:'crm5',  stream:'CRM', step:'5',   name:'Importing data',                               start:'2026-04-13', end:'2026-09-07', status:'Not started', isStep:true  },
  { id:'crm6',  stream:'CRM', step:'6',   name:'Continuous testing',                           start:'2026-06-01', end:'2026-10-26', status:'Not started', isStep:true  },
];

// ─── Helpers ───
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDate = (d: string) => { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const getWeekDates = (offset = 0) => {
  const now = new Date(); now.setDate(now.getDate() + offset * 7);
  const day = now.getDay(); const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 5 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
};
const dateStr = (d: Date) => d.toISOString().split('T')[0];

// ─── Design System ───
const C = {
  bg: '#f2f2f7', surface: '#ffffff', surfaceAlt: '#f9f9fb',
  border: '#e5e5ea', borderStrong: '#c7c7cc',
  text: '#1c1c1e', textMuted: '#636366', textDim: '#aeaeb2',
  accent: '#0071e3', crm: '#0071e3', ipaas: '#5e5ce6', datahub: '#f59e0b', control: '#ff9f0a',
  danger: '#ff3b30', p0: '#ff3b30', p1: '#ff9f0a', p2: '#aeaeb2',
  notStarted: '#c7c7cc', inProgress: '#0071e3', done: '#34c759', success: '#34c759',
  sectionBg: '#f2f2f7',
};
const streamColor = (s: string) => ({ CRM: C.crm, iPaaS: C.ipaas, 'Data Hub': C.datahub, 'Control Tower': C.control }[s] || C.accent);
const streamEmoji = (s: string) => ({ CRM: '🔵', iPaaS: '🟣', 'Data Hub': '🟠', 'Control Tower': '🟡' }[s] || '⚪');


const launchConfetti = () => {
  const colors = ['#0071e3','#5e5ce6','#f59e0b','#ff9f0a','#34c759','#ff3b30'];
  for (let i = 0; i < 22; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = (30 + Math.random() * 40) + 'vw';
    el.style.top = (20 + Math.random() * 30) + 'vh';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = (Math.random() * 0.4) + 's';
    el.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
};

const storage = {
  get: (key: string) => { try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} },
};

// ─── Global CSS ───
const CSS = `
*{box-sizing:border-box;}
body{margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif;}
input,select,textarea,button{font-family:inherit;}
input[type=date]{color-scheme:light;}

.ni{background:#fff;border:1px solid #d1d1d6;border-radius:10px;padding:9px 13px;font-size:14px;color:#1c1c1e;outline:none;width:100%;transition:border-color .15s,box-shadow .15s;}
.ni:focus{border-color:#0071e3;box-shadow:0 0 0 3px rgba(0,113,227,.12);}
.ni::placeholder{color:#aeaeb2;}
.ni-date{background:#fff;border:1px solid #d1d1d6;border-radius:10px;padding:9px 13px;font-size:14px;color:#1c1c1e;outline:none;transition:border-color .15s;}
.ni-date:focus{border-color:#0071e3;box-shadow:0 0 0 3px rgba(0,113,227,.12);}
select.ni{cursor:pointer;}
textarea.ni{resize:vertical;min-height:80px;}

.bp{background:#0071e3;color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;}
.bp:hover{background:#0077ed;}
.bg{background:transparent;border:1px solid #d1d1d6;border-radius:9px;padding:6px 13px;font-size:13px;font-weight:500;cursor:pointer;color:#1c1c1e;transition:all .15s;white-space:nowrap;}
.bg:hover{background:#f0f0f5;border-color:#aeaeb2;}
.bg-danger{background:transparent;border:1px solid #ffc7c5;border-radius:9px;padding:6px 13px;font-size:13px;font-weight:500;cursor:pointer;color:#ff3b30;transition:all .15s;}
.bg-danger:hover{background:#fff2f2;}

.card{background:#fff;border-radius:14px;border:1px solid #e5e5ea;overflow:hidden;}
.section-label{font-size:11px;font-weight:700;color:#636366;text-transform:uppercase;letter-spacing:.8px;margin:20px 0 10px;}
.row-hover:hover{background:#f5f5f7!important;cursor:pointer;}
.pill-active{background:#fff!important;box-shadow:0 1px 5px rgba(0,0,0,.12)!important;color:#1c1c1e!important;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(80px) rotate(720deg);opacity:0}}
.fade-up{animation:fadeUp .25s ease both;}
.confetti-piece{position:fixed;width:8px;height:8px;border-radius:2px;animation:confetti .8s ease forwards;pointer-events:none;z-index:9999;}

/* Rich text editor */
.editor-toolbar button{background:none;border:1px solid #e5e5ea;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px;margin:0 2px;transition:all .15s;}
.editor-toolbar button:hover{background:#f0f0f5;}
.editor-toolbar button.active{background:#0071e3;color:#fff;border-color:#0071e3;}
[contenteditable]{outline:none;}
[contenteditable]:empty:before{content:attr(data-placeholder);color:#aeaeb2;}

/* Owner multi-select pills */
.owner-pills{display:flex;flex-wrap:wrap;gap:5px;padding:8px 0;}
.owner-pill{padding:4px 11px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid #d1d1d6;background:#fff;color:#636366;transition:all .15s;user-select:none;}
.owner-pill.selected{background:#0071e3;color:#fff;border-color:#0071e3;}
`;

// ─── Owner Multi-Select ───
const OwnerSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const selected = value ? value.split(', ').filter(Boolean) : [];
  const toggle = (o: string) => {
    const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o];
    onChange(next.join(', '));
  };
  return (
    <div className="owner-pills">
      {OWNERS.map(o => (
        <span key={o} className={`owner-pill${selected.includes(o) ? ' selected' : ''}`} onClick={() => toggle(o)}>{o}</span>
      ))}
    </div>
  );
};

// ─── Rich Text Editor ───
const RichEditor = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
  }, []);

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current?.focus(); updateState(); };
  const updateState = () => { setBoldActive(document.queryCommandState('bold')); setItalicActive(document.queryCommandState('italic')); };

  return (
    <div style={{ border: '1px solid #d1d1d6', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div className="editor-toolbar" style={{ padding: '8px 12px', borderBottom: '1px solid #e5e5ea', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={boldActive ? 'active' : ''} onMouseDown={e => { e.preventDefault(); exec('bold'); }} title="Bold"><b>B</b></button>
        <button className={italicActive ? 'active' : ''} onMouseDown={e => { e.preventDefault(); exec('italic'); }} title="Italic"><i>I</i></button>
        <button onMouseDown={e => { e.preventDefault(); exec('underline'); }} title="Underline"><u>U</u></button>
        <div style={{ width: 1, height: 18, background: '#e5e5ea', margin: '0 4px' }} />
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet list">• List</button>
        <button onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }} title="Numbered list">1. List</button>
        <div style={{ width: 1, height: 18, background: '#e5e5ea', margin: '0 4px' }} />
        <button onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'h2'); }} title="Heading" style={{ fontWeight: 700 }}>H</button>
        <button onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'p'); }} title="Paragraph">¶</button>
        <div style={{ width: 1, height: 18, background: '#e5e5ea', margin: '0 4px' }} />
        <button onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }} title="Clear format" style={{ fontSize: 11 }}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        data-placeholder={placeholder || 'Write meeting notes…'}
        onInput={() => { onChange(ref.current?.innerHTML || ''); updateState(); }}
        onKeyUp={updateState}
        onMouseUp={updateState}
        style={{ padding: '16px', minHeight: 300, fontSize: 14, lineHeight: 1.7, color: C.text, overflowY: 'auto', textAlign: 'left' }}
      />
    </div>
  );
};

// ─── Confirm-delete button (stateless — uses window.confirm to avoid hook issues) ───
const DelBtn = ({ onClick, label = 'this item' }: { onClick: () => void; label?: string }) => (
  <button
    onClick={e => { e.stopPropagation(); if (window.confirm(`Delete ${label}?`)) onClick(); }}
    style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
    title={`Delete ${label}`}>×</button>
);

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('Weekly');
  const [activeStream, setActiveStream] = useState<Stream>('Control Tower');
  const [taskModal, setTaskModal] = useState<{ task: Task; stream: Stream } | null>(null);
  const [meetingModal, setMeetingModal] = useState<{ meeting: MeetingNote; stream: Stream } | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [weekOffset, setWeekOffset] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  const saveDraft = (draft: Omit<DraftItem, 'id' | 'savedAt'> & { itemId?: string }) => {
    setDrafts(prev => {
      // Replace existing draft of same kind+stream+itemId (same specific item), or add new
      const itemId = draft.itemId || '';
      const filtered = prev.filter(d => !(d.kind === draft.kind && d.stream === draft.stream && (d.payload as any).itemId === itemId));
      return [...filtered, { ...draft, id: uid(), savedAt: Date.now(), payload: { ...draft.payload, itemId } }];
    });
  };
  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));

  const buildDefault = (): AppData => {
    const d: AppData = {
      tasks: {}, notes: {}, decisions: {}, meetings: {},
      streamItems: {},
      controlTower: { askVattenfall: [], keyMessages: [] },
    };
    STREAMS.forEach(s => {
      d.tasks[s] = SEED_TASKS[s] || [];
      d.notes[s] = [];
      d.decisions[s] = [];
      d.meetings[s] = [];
    });
    WORK_STREAMS.forEach(s => { d.streamItems[s] = { toBeDiscussed: [], potentialRisks: [] }; });
    return d;
  };

  useEffect(() => {
    const r = storage.get(STORAGE_KEY);
    if (r) {
      try {
        const p = JSON.parse(r.value) as AppData;
        STREAMS.forEach(s => {
          if (!p.tasks[s]) p.tasks[s] = SEED_TASKS[s] || [];
          if (!p.notes[s]) p.notes[s] = [];
          if (!p.decisions[s]) p.decisions[s] = [];
          if (!p.meetings[s]) p.meetings[s] = [];
        });
        if (!p.streamItems) p.streamItems = {};
        WORK_STREAMS.forEach(s => { if (!p.streamItems[s]) p.streamItems[s] = { toBeDiscussed: [], potentialRisks: [] }; });
        if (!p.controlTower) p.controlTower = { askVattenfall: [], keyMessages: [] };
        setData(p);
      } catch { setData(buildDefault()); }
    } else { setData(buildDefault()); }
    setLoading(false);
  }, []);

  const save = (nd: AppData) => { setData(nd); storage.set(STORAGE_KEY, JSON.stringify(nd)); };



  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `nova-data-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target?.result as string) as AppData;
        STREAMS.forEach(s => { if (!p.tasks[s]) p.tasks[s] = []; if (!p.notes[s]) p.notes[s] = []; if (!p.decisions[s]) p.decisions[s] = []; if (!p.meetings) p.meetings = {}; if (!p.meetings[s]) p.meetings[s] = []; });
        if (!p.streamItems) p.streamItems = {}; WORK_STREAMS.forEach(s => { if (!p.streamItems[s]) p.streamItems[s] = { toBeDiscussed: [], potentialRisks: [] }; });
        if (!p.controlTower) p.controlTower = { askVattenfall: [], keyMessages: [] };
        save(p); alert('✅ Data imported!');
      } catch { alert('❌ Invalid file.'); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  if (loading || !data) return <div style={{ background: C.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center', color: C.text }}><div style={{ fontSize: 22, fontWeight: 700 }}>SUPER-NOVA</div><div style={{ color: C.textMuted, marginTop: 6 }}>Loading…</div></div></div>;

  // ─── Data Mutators ───
  const addTask = (stream: Stream, task: Partial<Task>) => save({ ...data, tasks: { ...data.tasks, [stream]: [...(data.tasks[stream] || []), { id: uid(), status: 'Not started', priority: '', description: '', dueDate: '', ...task, stream } as Task] } });
  const updateTask = (stream: Stream, id: string, updates: Partial<Task>) => {
    const prev = data.tasks[stream]?.find(t => t.id === id);
    if (updates.status === 'Done' && prev?.status !== 'Done') launchConfetti();
    save({ ...data, tasks: { ...data.tasks, [stream]: data.tasks[stream].map(t => t.id === id ? { ...t, ...updates } : t) } });
  };
  const deleteTask = (stream: Stream, id: string) => save({ ...data, tasks: { ...data.tasks, [stream]: data.tasks[stream].filter(t => t.id !== id) } });
  const addDecision = (stream: Stream, dec: Omit<Decision, 'id'>) => save({ ...data, decisions: { ...data.decisions, [stream]: [...(data.decisions[stream] || []), { id: uid(), ...dec }] } });
  const deleteDecision = (stream: Stream, id: string) => save({ ...data, decisions: { ...data.decisions, [stream]: data.decisions[stream].filter(d => d.id !== id) } });
  const updateDecision = (stream: Stream, id: string, updates: Partial<Decision>) => save({ ...data, decisions: { ...data.decisions, [stream]: data.decisions[stream].map(d => d.id === id ? { ...d, ...updates } : d) } });
  const updateStreamItem = (stream: Stream, key: 'toBeDiscussed' | 'potentialRisks', id: string, updates: Partial<StreamItem>) => { const si = { ...(data.streamItems[stream] || { toBeDiscussed: [], potentialRisks: [] }) }; si[key] = si[key].map(i => i.id === id ? { ...i, ...updates } : i); save({ ...data, streamItems: { ...data.streamItems, [stream]: si } }); };
  const updateControlTower = (key: 'askVattenfall' | 'keyMessages', id: string, updates: Partial<StreamItem>) => save({ ...data, controlTower: { ...data.controlTower, [key]: data.controlTower[key].map(i => i.id === id ? { ...i, ...updates } : i) } });
  const addMeeting = (stream: Stream, m: Omit<MeetingNote, 'id'>) => save({ ...data, meetings: { ...data.meetings, [stream]: [...(data.meetings[stream] || []), { id: uid(), ...m }] } });
  const updateMeeting = (stream: Stream, id: string, updates: Partial<MeetingNote>) => save({ ...data, meetings: { ...data.meetings, [stream]: (data.meetings[stream] || []).map(m => m.id === id ? { ...m, ...updates } : m) } });
  const deleteMeeting = (stream: Stream, id: string) => save({ ...data, meetings: { ...data.meetings, [stream]: (data.meetings[stream] || []).filter(m => m.id !== id) } });
  const addStreamItem = (stream: Stream, key: 'toBeDiscussed' | 'potentialRisks', item: Omit<StreamItem, 'id'>) => {
    const si = { ...(data.streamItems[stream] || { toBeDiscussed: [], potentialRisks: [] }) };
    si[key] = [...si[key], { id: uid(), ...item }];
    save({ ...data, streamItems: { ...data.streamItems, [stream]: si } });
  };
  const deleteStreamItem = (stream: Stream, key: 'toBeDiscussed' | 'potentialRisks', id: string) => {
    const si = { ...(data.streamItems[stream] || { toBeDiscussed: [], potentialRisks: [] }) };
    si[key] = si[key].filter(i => i.id !== id);
    save({ ...data, streamItems: { ...data.streamItems, [stream]: si } });
  };
  const addControlTower = (key: 'askVattenfall' | 'keyMessages', item: Omit<StreamItem, 'id'>) => save({ ...data, controlTower: { ...data.controlTower, [key]: [...data.controlTower[key], { id: uid(), ...item }] } });
  const deleteControlTower = (key: 'askVattenfall' | 'keyMessages', id: string) => save({ ...data, controlTower: { ...data.controlTower, [key]: data.controlTower[key].filter(i => i.id !== id) } });

  const allTasks = STREAMS.flatMap(s => data.tasks[s] || []);
  // Health score per work stream: 100 - (P0 overdue * 20) - (P0 not started * 10) - (decisions pending ratio * 10)
  const healthScore = (stream: Stream): { score: number; color: string; label: string } => {
    const tasks = data.tasks[stream] || [];
    const today = todayStr();
    const p0Overdue = tasks.filter(t => t.priority === 'P0' && t.status !== 'Done' && t.dueDate && t.dueDate < today).length;
    const p0Pending = tasks.filter(t => t.priority === 'P0' && t.status === 'Not started').length;
    const total = tasks.length || 1;
    const done = tasks.filter(t => t.status === 'Done').length;
    let score = Math.max(0, Math.min(100, Math.round((done / total) * 100) - p0Overdue * 18 - p0Pending * 8));
    const color = score >= 75 ? '#34c759' : score >= 45 ? '#ff9f0a' : '#ff3b30';
    const label = score >= 75 ? '🟢' : score >= 45 ? '🟡' : '🔴';
    return { score, color, label };
  };
  const allDecisions = STREAMS.flatMap(s => (data.decisions[s] || []).map(d => ({ ...d, stream: s as Stream })));
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'Done').length;
  const inProgressTasks = allTasks.filter(t => t.status === 'In progress').length;

  // ─── Micro-components ───
  const tag = (color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + '18', color, whiteSpace: 'nowrap' as const });
  const StatusBadge = ({ status }: { status: Status }) => <span style={tag({ 'Not started': C.notStarted, 'In progress': C.inProgress, Done: C.done }[status])}>{status}</span>;
  const PriorityBadge = ({ priority }: { priority: Priority }) => priority ? <span style={tag({ P0: C.p0, P1: C.p1, P2: C.p2 }[priority] || C.textDim)}>{priority}</span> : null;
  const StreamBadge = ({ stream }: { stream: string }) => <span style={tag(streamColor(stream))}>{stream}</span>;


  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.8px', margin: '20px 0 10px', paddingLeft: 2 }}>{children}</div>
  );

  const CardHeader = ({ title, action, color }: { title: React.ReactNode; action?: React.ReactNode; color?: string }) => (
    <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color ? color + '08' : undefined }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
      {action}
    </div>
  );

  // ─── Draft Bar ───
  const DraftBar = () => {
    if (drafts.length === 0) return null;
    return (
      <div style={{ position: 'sticky', top: 56, zIndex: 90, background: '#fffbf0', borderBottom: `2px solid ${C.p1}`, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.p1, textTransform: 'uppercase', letterSpacing: '.6px', flexShrink: 0 }}>✏️ Unsaved drafts</span>
        <div style={{ width: 1, height: 18, background: C.p1 + '40', flexShrink: 0 }} />
        {drafts.map(d => {
          const color = streamColor(d.stream);
          const kindIcon = { task: '✅', meeting: '📋', decision: '🔷' }[d.kind];
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1.5px solid ${color}40`, borderRadius: 20, padding: '4px 6px 4px 10px', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = color}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = color + '40'}
              onClick={() => {
                // Restore draft into the appropriate modal
                if (d.kind === 'meeting') {
                  const payload = d.payload as { meeting: MeetingNote; stream: Stream };
                  setMeetingModal({ meeting: payload.meeting as MeetingNote, stream: d.stream });
                } else if (d.kind === 'task') {
                  const payload = d.payload as { task: Task };
                  setTaskModal({ task: payload.task as Task, stream: d.stream });
                }
                removeDraft(d.id);
              }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color }}>{d.stream}</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>{kindIcon} {d.label}</span>
              <button onClick={e => { e.stopPropagation(); removeDraft(d.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 15, lineHeight: 1, padding: '0 2px', marginLeft: 2 }}>×</button>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Quick Add Task ───
  const QuickAdd = ({ stream }: { stream: Stream }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [owner, setOwner] = useState('');
    const [priority, setPriority] = useState<Priority>('');
    const [dueDate, setDueDate] = useState('');
    const color = streamColor(stream);

    const reset = () => { setTitle(''); setNote(''); setOwner(''); setPriority(''); setDueDate(''); setOpen(false); };
    const submit = () => {
      if (!title.trim()) return;
      addTask(stream, { title: title.trim(), description: note.trim(), owner, priority, dueDate });
      reset();
    };

    const pColors: Record<string, string> = { P0: C.p0, P1: C.p1, P2: C.p2 };

    const Divider = () => <div style={{width:1,background:C.border,alignSelf:'stretch',margin:'0 4px'}}/>;

    return (
      <div className="card" style={{ marginBottom: 12, borderTop: `3px solid ${color}` }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: color+'18', border:`1.5px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', color, fontSize: 16 }}>+</div>
            <span>Add a task…</span>
          </button>
        ) : (
          <div style={{ padding: '16px 18px' }}>
            {/* Title */}
            <input className="ni" autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Task title…" onKeyDown={e => e.key==='Enter' && submit()}
              style={{ marginBottom: 12, fontSize: 15, fontWeight: 500 }} />

            {/* Row 2: Priority · Owner · Date all in one clean line with visual separators */}
            <div style={{ display:'flex', gap:0, alignItems:'flex-start', marginBottom:12, background:C.sectionBg, borderRadius:12, border:`1px solid ${C.border}`, padding:'10px 14px' }}>
              {/* Priority */}
              <div style={{ flexShrink:0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6 }}>Priority</div>
                <div style={{ display:'flex', gap:4 }}>
                  {(['P0','P1','P2'] as Priority[]).map(p => (
                    <button key={p} onClick={() => setPriority(priority===p ? '' : p)}
                      style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                        border:`1.5px solid ${priority===p ? pColors[p] : C.border}`,
                        background: priority===p ? pColors[p]+'18' : '#fff',
                        color: priority===p ? pColors[p] : C.textMuted, transition:'all .15s' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <Divider/>

              {/* Owner */}
              <div style={{ flex:1, padding:'0 10px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6 }}>Owner</div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {OWNERS.map(o => {
                    const sel = owner.split(', ').filter(Boolean).includes(o);
                    return (
                      <button key={o} onClick={() => {
                        const cur = owner.split(', ').filter(Boolean);
                        setOwner((sel ? cur.filter(x=>x!==o) : [...cur,o]).join(', '));
                      }} style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                        border:`1.5px solid ${sel ? color : C.border}`,
                        background: sel ? color+'18' : '#fff',
                        color: sel ? color : C.textMuted, transition:'all .15s' }}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Divider/>

              {/* Due date */}
              <div style={{ flexShrink:0, paddingLeft:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6 }}>Due date</div>
                <input className="ni-date" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={{ width:150 }} />
              </div>
            </div>

            {/* Note */}
            <textarea className="ni" value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Add a note… (optional)" style={{ minHeight:52, resize:'none', fontSize:13, marginBottom:12 }} />

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="bg" onClick={reset}>Cancel</button>
              <button className="bp" onClick={submit} style={{ paddingLeft:28, paddingRight:28 }}>Add task</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Task Card ───
  const TaskCard = ({ task, stream }: { task: Task; stream: Stream }) => {
    const today = todayStr();
    const isOverdue = task.dueDate && task.dueDate < today && task.status !== 'Done';
    const isDue3Days = task.dueDate && task.dueDate >= today && task.dueDate <= (() => { const d = new Date(); d.setDate(d.getDate()+3); return d.toISOString().split('T')[0]; })() && task.status !== 'Done';
    let bg = '#fff'; let borderColor = C.border; let leftBar = streamColor(stream);
    if (task.status === 'Done') { bg = '#f0fdf4'; borderColor = '#34c75930'; leftBar = C.done; }
    else if (task.priority === 'P0' && isOverdue) { bg = '#fff5f5'; borderColor = '#ff3b3030'; leftBar = C.danger; }
    else if (task.priority === 'P0' && isDue3Days) { bg = '#fffbf0'; borderColor = '#ff9f0a30'; leftBar = C.p1; }
    return (
    <div onClick={() => setTaskModal({ task, stream })} className="fade-up"
      style={{ background: bg, borderRadius: 10, padding: '11px 13px', marginBottom: 8, cursor: 'pointer', border: `1px solid ${borderColor}`, transition: 'all .15s', textAlign: 'left', borderLeft: `3px solid ${leftBar}` }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 7, lineHeight: 1.4 }}>{task.title}</div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {task.owner && <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, padding: '1px 7px', borderRadius: 5 }}>{task.owner}</span>}
        {task.priority && <PriorityBadge priority={task.priority} />}
        {task.dueDate && <span style={{ fontSize: 11, color: isOverdue ? C.danger : C.textDim, fontWeight: isOverdue ? 600 : 400 }}>{isOverdue ? '⚠ ' : ''}{fmtDate(task.dueDate)}</span>}
      </div>
    </div>
    );
  };

  // ─── Kanban with drag & drop ───
  const Kanban = ({ stream }: { stream: Stream }) => {
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<Status | null>(null);

    const handleDragStart = (id: string) => setDragId(id);
    const handleDragEnd = () => { setDragId(null); setDragOver(null); };
    const handleDrop = (status: Status) => {
      if (!dragId) return;
      updateTask(stream, dragId, { status });
      setDragId(null); setDragOver(null);
    };

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
        {STATUSES.map(status => {
          const col = (data.tasks[stream] || []).filter(t => t.status === status);
          const dotColor = { 'Not started': C.notStarted, 'In progress': C.inProgress, Done: C.done }[status];
          const isOver = dragOver === status;
          return (
            <div key={status}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(status)}
              style={{ background: isOver ? streamColor(stream) + '0a' : C.sectionBg, borderRadius: 14, border: `1.5px solid ${isOver ? streamColor(stream) : C.border}`, overflow: 'hidden', transition: 'border-color .15s, background .15s' }}>
              <div style={{ padding: '10px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.4px' }}>{status}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textDim, background: C.bg, padding: '1px 7px', borderRadius: 8 }}>{col.length}</span>
              </div>
              <div style={{ padding: 8, minHeight: 80 }}>
                {col.map(t => (
                  <div key={t.id} draggable onDragStart={() => handleDragStart(t.id)} onDragEnd={handleDragEnd}
                    style={{ opacity: dragId === t.id ? 0.4 : 1, cursor: 'grab' }}>
                    <TaskCard task={t} stream={stream} />
                  </div>
                ))}
                {isOver && dragId && <div style={{ height: 3, borderRadius: 3, background: streamColor(stream), margin: '4px 0' }} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Decisions ───
  const DecisionsList = ({ stream }: { stream: Stream }) => {
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({ name: '', date: todayStr(), owner: '', description: '', decided: false });
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Decision>>({});
    const decisions = data.decisions[stream] || [];
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <CardHeader title="🔷 Decisions" action={<button className="bg" onClick={() => setShow(!show)}>{show ? 'Cancel' : '+ Add'}</button>} />
        {show && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="ni" placeholder="Decision name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="ni-date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.decided} onChange={e => setForm({ ...form, decided: e.target.checked })} />
              Decision taken
            </label>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Owner</div>
          <OwnerSelect value={form.owner} onChange={v => setForm({ ...form, owner: v })} />
          <textarea className="ni" placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 60, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="bp" onClick={() => { if (form.name.trim()) { addDecision(stream, form); setForm({ name: '', date: todayStr(), owner: '', description: '', decided: false }); setShow(false); } }}>Save</button>
          </div>
        </div>}
        {decisions.length === 0 ? <div style={{ padding: '13px 16px', fontSize: 13, color: C.textDim }}>No decisions yet</div> : decisions.map(d => (
          <div key={d.id} style={{ borderTop: `1px solid ${C.border}` }}>
            {editId === d.id ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: C.sectionBg }}>
                <input className="ni" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="ni-date" type="date" value={editForm.date || ''} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editForm.decided} onChange={e => setEditForm({ ...editForm, decided: e.target.checked })} />
                    Decision taken
                  </label>
                </div>
                <OwnerSelect value={editForm.owner || ''} onChange={v => setEditForm({ ...editForm, owner: v })} />
                <textarea className="ni" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ minHeight: 60, resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="bg" onClick={() => setEditId(null)}>Cancel</button>
                  <button className="bp" onClick={() => { updateDecision(stream, d.id, editForm); setEditId(null); }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: d.decided ? '#34c75918' : '#ff9f0a18', color: d.decided ? '#34c759' : '#ff9f0a', whiteSpace: 'nowrap' }}>
                      {d.decided ? '✅ Decided' : '⏳ Pending'}
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{d.name}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{fmtDate(d.date)}{d.owner ? ` · ${d.owner}` : ''}</div>
                  {d.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{d.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(d.id); setEditForm(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textDim, padding: '0 4px' }} title="Edit">✏️</button>
                  <DelBtn onClick={() => deleteDecision(stream, d.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── Generic Stream Item Box (editable) ───
  const StreamItemBox = ({ stream, storageKey, title, icon, color }: { stream: Stream; storageKey: 'toBeDiscussed' | 'potentialRisks'; title: string; icon: string; color: string }) => {
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({ title: '', owner: '', dueDate: '', description: '' });
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<StreamItem>>({});
    const items = (data.streamItems[stream]?.[storageKey]) || [];
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <CardHeader title={`${icon} ${title}`} color={color} action={<button className="bg" onClick={() => setShow(!show)}>{show ? 'Cancel' : '+ Add'}</button>} />
        {show && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="ni" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <OwnerSelect value={form.owner} onChange={v => setForm({ ...form, owner: v })} />
          <input className="ni-date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          <textarea className="ni" placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 52, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bp" onClick={() => { if (form.title.trim()) { addStreamItem(stream, storageKey, form); setForm({ title: '', owner: '', dueDate: '', description: '' }); setShow(false); } }}>Save</button>
          </div>
        </div>}
        {items.length === 0 ? <div style={{ padding: '13px 16px', fontSize: 13, color: C.textDim }}>Nothing yet</div> : items.map(item => (
          <div key={item.id} style={{ borderTop: `1px solid ${C.border}` }}>
            {editId === item.id ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: C.sectionBg }}>
                <input className="ni" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                <OwnerSelect value={editForm.owner || ''} onChange={v => setEditForm({ ...editForm, owner: v })} />
                <input className="ni-date" type="date" value={editForm.dueDate || ''} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
                <textarea className="ni" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ minHeight: 52, resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="bg" onClick={() => setEditId(null)}>Cancel</button>
                  <button className="bp" onClick={() => { updateStreamItem(stream, storageKey, item.id, editForm); setEditId(null); }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.title}</div>
                  {item.owner && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.owner}{item.dueDate ? ` · ${fmtDate(item.dueDate)}` : ''}</div>}
                  {item.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{item.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(item.id); setEditForm(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textDim, padding: '0 4px' }}>✏️</button>
                  <DelBtn onClick={() => deleteStreamItem(stream, storageKey, item.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── Control Tower Item Box (editable) ───
  const ControlTowerBox = ({ storageKey, title, icon, color }: { storageKey: 'askVattenfall' | 'keyMessages'; title: string; icon: string; color: string }) => {
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({ title: '', owner: '', dueDate: '', description: '' });
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<StreamItem>>({});
    const items = data.controlTower[storageKey] || [];
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <CardHeader title={`${icon} ${title}`} color={color} action={<button className="bg" onClick={() => setShow(!show)}>{show ? 'Cancel' : '+ Add'}</button>} />
        {show && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="ni" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <OwnerSelect value={form.owner} onChange={v => setForm({ ...form, owner: v })} />
          <input className="ni-date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          <textarea className="ni" placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 52, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bp" onClick={() => { if (form.title.trim()) { addControlTower(storageKey, form); setForm({ title: '', owner: '', dueDate: '', description: '' }); setShow(false); } }}>Save</button>
          </div>
        </div>}
        {items.length === 0 ? <div style={{ padding: '13px 16px', fontSize: 13, color: C.textDim }}>Nothing yet</div> : items.map(item => (
          <div key={item.id} style={{ borderTop: `1px solid ${C.border}` }}>
            {editId === item.id ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: C.sectionBg }}>
                <input className="ni" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                <OwnerSelect value={editForm.owner || ''} onChange={v => setEditForm({ ...editForm, owner: v })} />
                <input className="ni-date" type="date" value={editForm.dueDate || ''} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
                <textarea className="ni" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ minHeight: 52, resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="bg" onClick={() => setEditId(null)}>Cancel</button>
                  <button className="bp" onClick={() => { updateControlTower(storageKey, item.id, editForm); setEditId(null); }}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.title}</div>
                  {item.owner && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.owner}{item.dueDate ? ` · ${fmtDate(item.dueDate)}` : ''}</div>}
                  {item.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{item.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(item.id); setEditForm(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textDim, padding: '0 4px' }}>✏️</button>
                  <DelBtn onClick={() => deleteControlTower(storageKey, item.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── Meetings / CR ───
  const MeetingsList = ({ stream }: { stream: Stream }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState(todayStr());
    const meetings = data.meetings[stream] || [];
    const color = streamColor(stream);
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <CardHeader title="📋 Meeting Notes (CR)" color={color}
          action={<button className="bg" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ New CR'}</button>} />
        {showAdd && (
          <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input className="ni" style={{ flex: 2 }} placeholder="Meeting title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
            <input className="ni-date" type="date" style={{ flex: 1 }} value={newDate} onChange={e => setNewDate(e.target.value)} />
            <button className="bp" onClick={() => { if (newTitle.trim()) { const m: Omit<MeetingNote, 'id'> = { title: newTitle.trim(), date: newDate, content: '' }; addMeeting(stream, m); setNewTitle(''); setNewDate(todayStr()); setShowAdd(false); setTimeout(() => { const all = data.meetings[stream] || []; /* will open after save */ }, 100); } }}>Create</button>
          </div>
        )}
        {meetings.length === 0 ? <div style={{ padding: '13px 16px', fontSize: 13, color: C.textDim }}>No meeting notes yet</div> : meetings.map(m => (
          <div key={m.id} onClick={() => setMeetingModal({ meeting: m, stream })} className="row-hover"
            style={{ padding: '11px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(m.date)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: C.textDim }}>Open →</span>
              <DelBtn onClick={() => deleteMeeting(stream, m.id)} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Meeting Modal (rich editor + photo upload) ───
  const MeetingModalView = ({ meeting, stream }: { meeting: MeetingNote; stream: Stream }) => {
    const [title, setTitle] = useState(meeting.title);
    const [date, setDate] = useState(meeting.date);
    const [content, setContent] = useState(meeting.content);
    const [photos, setPhotos] = useState<string[]>(meeting.photos || []);
    const [lightbox, setLightbox] = useState<string | null>(null);
    const [tab, setTab] = useState<'notes'|'photos'>('notes');
    const [photoWidths, setPhotoWidths] = useState<number[]>([]);
    const photoRef = useRef<HTMLInputElement>(null);

    const getPhotoWidth = (i: number) => photoWidths[i] ?? 420;
    const setPhotoWidth = (i: number, w: number) => setPhotoWidths(prev => { const n = [...prev]; n[i] = w; return n; });
    const color = streamColor(stream);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => setPhotos(prev => [...prev, ev.target?.result as string]);
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    // Intercept paste at window level.
    // If clipboard contains an image: capture it into Photos AND prevent the raw image
    // blob from rendering inside the contentEditable (which caused the double-modal bug).
    // Plain text pastes are NOT intercepted and work normally in the editor.
    useEffect(() => {
      const onPaste = (e: ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(it => it.type.startsWith('image/'));
        if (!imageItem) return;
        // Add image to Photos gallery
        const file = imageItem.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            setPhotos(prev => [...prev, ev.target?.result as string]);
            // Switch to photos tab so user sees it was captured
            setTab('photos');
          };
          reader.readAsDataURL(file);
        }
        // Don't preventDefault — let the image also paste inline into the contentEditable
        // (the user wants it in both Notes and Photos)
      };
      window.addEventListener('paste', onPaste);
      return () => window.removeEventListener('paste', onPaste);
    }, []);

    const handleBackdropClick = () => {
      // If there's any content, save as draft instead of discarding
      const hasContent = title !== meeting.title || date !== meeting.date || content !== meeting.content || photos.length !== (meeting.photos || []).length;
      if (hasContent) {
        saveDraft({
          kind: 'meeting',
          stream,
          label: title || 'Untitled meeting',
          itemId: meeting.id,
          payload: { meeting: { ...meeting, title, date, content, photos } as MeetingNote },
        });
      }
      setMeetingModal(null);
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 300, overflowY: 'auto', padding: '40px 20px' }}
        onClick={e => { if (e.target === e.currentTarget) handleBackdropClick(); }}>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
        {lightbox && (
          <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
            <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
          </div>
        )}
        <div className="card" style={{ width: '100%', maxWidth: 820, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color + '08' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StreamBadge stream={stream} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>Meeting Note</span>
            </div>
            <button onClick={() => setMeetingModal(null)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {/* Title + date row */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <input className="ni" style={{ fontSize: 18, fontWeight: 700, flex: 1 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title…" />
              <input className="ni-date" type="date" style={{ width: 160, flexShrink: 0 }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: C.sectionBg, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, width: 'fit-content' }}>
              {([['notes','📝 Notes'],['photos',`📸 Photos${photos.length ? ` (${photos.length})` : ''}`]] as const).map(([t,label]) => (
                <div key={t} onClick={() => setTab(t)} className={tab===t?'pill-active':''} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: tab===t ? C.text : C.textMuted, transition: 'all .15s' }}>{label}</div>
              ))}
            </div>
            {/* Notes tab */}
            {tab === 'notes' && (
              <div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>💡 Tip: paste a screenshot directly anywhere in this modal to add it to Photos</div>
                <RichEditor value={content} onChange={setContent} placeholder="Write your meeting notes here… Use the toolbar for formatting." />
              </div>
            )}
            {/* Photos tab */}
            {tab === 'photos' && (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                  <button className="bg" onClick={() => photoRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>📎 Upload photos</button>
                  <span style={{ fontSize: 12, color: C.textDim }}>or paste a screenshot anywhere in this modal (Ctrl+V / Cmd+V)</span>
                </div>
                {photos.length === 0 ? (
                  <div onClick={() => photoRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', color: C.textDim, fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                    <div>Click to upload or paste a screenshot</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {photos.map((p, i) => {
                      const w = getPhotoWidth(i);
                      return (
                        <div key={i} style={{ position: 'relative', display: 'block' }}>
                          <img src={p} style={{ width: w, maxWidth: '100%', borderRadius: 10, border: `1px solid ${C.border}`, display: 'block', cursor: 'zoom-in' }} onClick={() => setLightbox(p)} />
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.textDim }}>🔍</span>
                            <input type="range" min={100} max={760} value={w} onChange={e => setPhotoWidth(i, Number(e.target.value))}
                              style={{ flex: 1, accentColor: C.accent }} />
                            <span style={{ fontSize: 11, color: C.textDim, minWidth: 36 }}>{w}px</span>
                            <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))}
                              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: C.danger }}>Delete</button>
                          </div>
                        </div>
                      );
                    })}
                    <div onClick={() => photoRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', color: C.textDim, fontSize: 13 }}>+ Add another photo</div>
                  </div>
                )}
              </div>
            )}
            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <DelBtn onClick={() => { deleteMeeting(stream, meeting.id); setMeetingModal(null); }} label="this meeting note" />
              <button className="bp" onClick={() => { updateMeeting(stream, meeting.id, { title, date, content, photos }); setMeetingModal(null); }}>Save</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Task Detail Modal ───
  const TaskModalView = ({ task, stream }: { task: Task; stream: Stream }) => {
    const [form, setForm] = useState({ ...task });
    const color = streamColor(stream);
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => {
          if (e.target !== e.currentTarget) return;
          const hasChanges = JSON.stringify(form) !== JSON.stringify(task);
          if (hasChanges) {
            saveDraft({ kind: 'task', stream, label: form.title || 'Untitled task', itemId: task.id, payload: { task: form } });
          }
          setTaskModal(null);
        }}>
        <div className="card" style={{ width: 500, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color + '08' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StreamBadge stream={stream} /><span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Task</span></div>
            <button onClick={() => setTaskModal(null)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Title</label><input className="ni" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Owner</label>
              <OwnerSelect value={form.owner || ''} onChange={v => setForm({ ...form, owner: v })} />
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Due date</label><input className="ni-date" type="date" style={{ width: '100%' }} value={form.dueDate || ''} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Status</label><select className="ni" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Priority</label><select className="ni" value={form.priority || ''} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}><option value="">None</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Notes</label><textarea className="ni" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add context…" /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
              <DelBtn onClick={() => { deleteTask(stream, task.id); setTaskModal(null); }} label="this task" />
              <button className="bp" onClick={() => { updateTask(stream, task.id, form); setTaskModal(null); }}>Save changes</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Weekly View ───
  const WeeklyView = () => {
    const [myTasks, setMyTasks] = useState(false);
    const days = getWeekDates(weekOffset);
    const weekStart = days[0]; const weekEnd = days[4];
    const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const weekDecisions = allDecisions.filter(d => { if (!d.date) return false; const ds = dateStr(days[0]); const de = dateStr(days[4]); return d.date >= ds && d.date <= de; });
    const today = todayStr();

    // Weekly card: always stream color (blue CRM, purple iPaaS, orange DataHub)
    const taskCardBg = (t: Task) => {
      const sc = streamColor(t.stream);
      return { bg: sc + '12', border: sc + '25', dot: sc };
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="bg" onClick={() => setWeekOffset(w => w - 1)}>←</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{weekLabel}</span>
          <button className="bg" onClick={() => setWeekOffset(w => w + 1)}>→</button>
          {weekOffset !== 0 && <button className="bg" onClick={() => setWeekOffset(0)}>Today</button>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>My tasks (SK)</span>
            <div onClick={() => setMyTasks(m => !m)} style={{ width: 38, height: 22, borderRadius: 11, background: myTasks ? C.accent : '#d1d1d6', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: myTasks ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>
          </div>
        </div>

        <SectionLabel>🔥 Top Priorities by Day</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
          {days.map((day, i) => {
            const ds = dateStr(day);
            const isToday = ds === today;
            const dayTasks = allTasks.filter(t => {
              if (t.dueDate !== ds) return false;
              if (t.priority === 'P2' || !t.priority) return false;
              if (myTasks && !t.owner.includes('SK')) return false;
              return true;
            });
            return (
              <div key={i} style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${isToday ? C.accent : C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, background: isToday ? C.accent + '10' : C.sectionBg }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? C.accent : C.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{DAYS[i]}</div>
                  <div style={{ fontSize: 11, color: isToday ? C.accent : C.textDim, fontWeight: 500, marginTop: 2 }}>{day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ padding: 8, minHeight: 60 }}>
                  {dayTasks.length === 0
                    ? <div style={{ fontSize: 11, color: C.textDim, padding: '6px 2px' }}>—</div>
                    : dayTasks.map(t => {
                        const { bg, border, dot } = taskCardBg(t);
                        return (
                          <div key={t.id} onClick={() => setTaskModal({ task: t, stream: t.stream })}
                            style={{ padding: '6px 8px', marginBottom: 5, borderRadius: 8, cursor: 'pointer', background: bg, border: `1px solid ${border}`, transition: 'all .15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.97)'}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.filter = 'none'}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 3 }}>{t.title}</div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
                              <PriorityBadge priority={t.priority} />
                              <span style={{ fontSize: 10, color: streamColor(t.stream), fontWeight: 600 }}>{t.stream}</span>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <CardHeader title={<>🔷 Decisions this week <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6, padding: '1px 7px', borderRadius: 10, background: C.ipaas + '18', color: C.ipaas }}>{weekDecisions.length}</span></>} />
          {weekDecisions.length === 0 ? <div style={{ padding: '13px 16px', fontSize: 13, color: C.textDim }}>No decisions this week</div> : weekDecisions.map(d => (
            <div key={d.id} style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <StreamBadge stream={d.stream!} />
              <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{d.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(d.date)}{d.owner ? ` · ${d.owner}` : ''}</div></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Calendar View ───
  const CalendarView = () => {
    const datedTasks = allTasks.filter(t => t.dueDate);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const prevMonth = () => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1);
    const nextMonth = () => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <button className="bg" onClick={prevMonth}>←</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{new Date(calYear, calMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          <button className="bg" onClick={nextMonth}>→</button>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${C.border}`, background: C.sectionBg }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} style={{ padding: '9px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: '110px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.sectionBg }} />;
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks = datedTasks.filter(t => t.dueDate === ds); const isT = ds === todayStr();
              return (
                <div key={day} style={{ padding: 7, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: isT ? C.accent : 'transparent', color: isT ? '#fff' : C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isT ? 700 : 400, marginBottom: 4 }}>{day}</div>
                  {dayTasks.slice(0, 2).map(t => <div key={t.id} onClick={() => setTaskModal({ task: t, stream: t.stream })} style={{ fontSize: 10, padding: '2px 5px', marginBottom: 2, borderRadius: 4, cursor: 'pointer', background: streamColor(t.stream) + '18', color: streamColor(t.stream), fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.title}</div>)}
                  {dayTasks.length > 2 && <div style={{ fontSize: 10, color: C.textDim }}>+{dayTasks.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };


  // ─── Roadmap / Gantt View ───
  const RoadmapView = () => {
    const [ganttFilter, setGanttFilter] = useState<'all'|'active'|'upcoming'>('all');
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(['dh1','dh2','dh4','ip2','ip4','crm1','crm2']));
    // subtask visibility controlled per-step via expandedSteps
    const [hoveredId, setHoveredId] = useState<string|null>(null);
    const [editingId, setEditingId] = useState<string|null>(null);
    const [editForm, setEditForm] = useState<{name:string;start:string;end:string;status:string}>({name:'',start:'',end:'',status:''});
    const [overrides, setOverrides] = useState<Record<string,Partial<RoadmapStep>>>({});
    const [customRows, setCustomRows] = useState<RoadmapStep[]>([]);
    const [addingRow, setAddingRow] = useState<{stream:string}|null>(null);
    const [newRow, setNewRow] = useState({name:'',start:'',end:'',status:'Not started',isStep:true,step:''});
    const ganttRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<{id:string;edge:'start'|'end'|'move';startX:number;origStart:string;origEnd:string}|null>(null);

    const today = todayStr();
    const rangeStart = new Date('2026-01-01');
    const rangeEnd   = new Date('2026-12-31');
    const totalDays  = Math.ceil((rangeEnd.getTime()-rangeStart.getTime())/86400000);
    const pct = (dateS: string) => {
      const d = new Date(dateS+'T00:00:00');
      const days = Math.ceil((d.getTime()-rangeStart.getTime())/86400000);
      return Math.max(0,Math.min(100,(days/totalDays)*100));
    };
    const todayPct = pct(today);
    const months = Array.from({length:12},(_,m) => {
      const d = new Date(2026,m,1);
      return { label: d.toLocaleDateString('en-GB',{month:'short'}), pct: pct(`2026-${String(m+1).padStart(2,'0')}-01`) };
    });

    // Merge seed + custom rows + overrides
    const allRows: RoadmapStep[] = [...ROADMAP, ...customRows].map(r => ({...r,...(overrides[r.id]||{})}));

    // Compute parent date ranges from sub-steps
    const computedRows = allRows.map(r => {
      if (!r.isStep) return r;
      const children = allRows.filter(x => x.stream===r.stream && !x.isStep && x.step.startsWith(r.step+'.') && x.start && x.end);
      if (children.length === 0) return r;
      const minStart = children.reduce((m,c) => c.start < m ? c.start : m, children[0].start);
      const maxEnd   = children.reduce((m,c) => c.end > m ? c.end : m, children[0].end);
      // Only expand if override exists for this parent (user hasn't manually set it)
      if (!overrides[r.id]?.start) return {...r, start: minStart < r.start ? minStart : r.start, end: maxEnd > r.end ? maxEnd : r.end};
      return r;
    });

    const streamRows = ['CRM','iPaaS','Data Hub'] as const;

    const visibleRows = computedRows.filter(r => {
      if (ganttFilter==='active') return r.status==='In Progress';
      if (ganttFilter==='upcoming') return r.status==='Not started' && r.start > today;
      return true;
    });

    // Coming up (45 days), grouped by stream
    const soonDate = new Date(); soonDate.setDate(soonDate.getDate()+45);
    const soonStr = soonDate.toISOString().split('T')[0];
    const upcoming = computedRows.filter(r => r.isStep && r.status!=='Done' && r.start >= today && r.start <= soonStr);

    // Drag logic
    useEffect(() => {
      if (!dragging) return;
      const onMove = (e: MouseEvent) => {
        if (!ganttRef.current) return;
        const rect = ganttRef.current.getBoundingClientRect();
        const dx = e.clientX - dragging.startX;
        const dpct = (dx/rect.width)*100;
        const days = Math.round((dpct/100)*totalDays);
        const shift = (d: string, delta: number) => { const dt = new Date(d+'T00:00:00'); dt.setDate(dt.getDate()+delta); return dt.toISOString().split('T')[0]; };
        let ns = dragging.origStart, ne = dragging.origEnd;
        if (dragging.edge==='start') { ns = shift(dragging.origStart,days); if (ns>=ne) return; }
        else if (dragging.edge==='end') { ne = shift(dragging.origEnd,days); if (ne<=ns) return; }
        else { ns = shift(dragging.origStart,days); ne = shift(dragging.origEnd,days); }
        setOverrides(prev => ({...prev,[dragging.id]:{...prev[dragging.id],start:ns,end:ne}}));
      };
      const onUp = () => setDragging(null);
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
      return () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    },[dragging]);

    const openEdit = (r: RoadmapStep) => { setEditingId(r.id); setEditForm({name:r.name,start:r.start,end:r.end,status:r.status}); };
    const saveEdit = () => {
      if (!editingId) return;
      setOverrides(prev => ({...prev,[editingId]:{...prev[editingId],...editForm}}));
      setEditingId(null);
    };

    const addCustomRow = () => {
      if (!addingRow || !newRow.name || !newRow.start || !newRow.end) return;
      const id = 'custom_' + uid();
      const existing = [...ROADMAP,...customRows].filter(r => r.stream===addingRow.stream && r.isStep);
      const stepNum = existing.length + 1;
      const step = newRow.step || String(stepNum);
      setCustomRows(prev => [...prev, {...newRow, id, stream: addingRow.stream, step, isStep: true} as RoadmapStep]);
      setNewRow({name:'',start:'',end:'',status:'Not started',isStep:true,step:''});
      setAddingRow(null);
    };

    const BarHandle = ({side, id, r}: {side:'start'|'end'; id:string; r:RoadmapStep}) => (
      <div style={{ position:'absolute', [side==='start'?'left':'right']:-5, top:'50%', transform:'translateY(-50%)', width:10, height:20, borderRadius:4, background:'rgba(255,255,255,.9)', cursor:'ew-resize', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,.25)', gap:1, zIndex:5 }}
        onMouseDown={e=>{ e.stopPropagation(); setDragging({id,edge:side,startX:e.clientX,origStart:r.start,origEnd:r.end}); }}>
        <div style={{width:1.5,height:10,background:'#aaa',borderRadius:1}}/><div style={{width:1.5,height:10,background:'#aaa',borderRadius:1}}/>
      </div>
    );

    return (
      <div>
        {/* Coming up, 3 columns */}
        {upcoming.length > 0 && (
          <div className="card" style={{marginBottom:20}}>
            <CardHeader title="📅 Starting soon (45 days)" />
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
              {streamRows.map((s,si) => {
                const items = upcoming.filter(r => r.stream===s);
                const color = streamColor(s);
                return (
                  <div key={s} style={{borderRight:si<2?`1px solid ${C.border}`:'none',padding:'12px 16px'}}>
                    <div style={{fontSize:11,fontWeight:800,color,textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10}}>{s}</div>
                    {items.length===0 ? <div style={{fontSize:12,color:C.textDim}}>Nothing starting soon</div> : items.map(r => (
                      <div key={r.id} style={{marginBottom:8,padding:'8px 10px',borderRadius:10,background:color+'0e',border:`1px solid ${color}22`}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.text,lineHeight:1.3}}>{r.name}</div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{fmtDate(r.start)} → {fmtDate(r.end)}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
          {(['all','active','upcoming'] as const).map(f => (
            <button key={f} className={ganttFilter===f?'bp':'bg'} style={{padding:'5px 14px',fontSize:12}} onClick={()=>setGanttFilter(f)}>
              {f==='all'?'All':f==='active'?'⬤ Active':'→ Upcoming'}
            </button>
          ))}
          <div style={{marginLeft:'auto',display:'flex',gap:14,fontSize:11,color:C.textMuted,alignItems:'center'}}>
            <span>💡 Click ▸ to expand steps · drag to move · double-click to edit</span>
            {[['Done','#34c759'],['In Progress',C.accent],['Not started',C.textDim]].map(([l,c])=>(
              <span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:3,background:c as string,display:'inline-block'}}/>{l}</span>
            ))}
          </div>
        </div>

        {/* Edit modal */}
        {editingId && (() => {
          const r = computedRows.find(x=>x.id===editingId)!;
          if (!r) return null;
          return (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.25)',backdropFilter:'blur(4px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setEditingId(null)}>
              <div className="card" style={{width:420,borderRadius:18,boxShadow:'0 20px 60px rgba(0,0,0,.2)',padding:24}} onClick={e=>e.stopPropagation()}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Edit · <span style={{color:streamColor(r.stream)}}>{r.stream} {r.step}</span></div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Name</label>
                    <input className="ni" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Start</label>
                      <input className="ni-date" type="date" style={{width:'100%'}} value={editForm.start} onChange={e=>setEditForm({...editForm,start:e.target.value})} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>End</label>
                      <input className="ni-date" type="date" style={{width:'100%'}} value={editForm.end} onChange={e=>setEditForm({...editForm,end:e.target.value})} /></div>
                  </div>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Status</label>
                    <select className="ni" value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})}>
                      {['Not started','In Progress','Done'].map(s=><option key={s}>{s}</option>)}
                    </select></div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                    <button className="bg" onClick={()=>setEditingId(null)}>Cancel</button>
                    <button className="bp" onClick={saveEdit}>Save</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add row modal */}
        {addingRow && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.25)',backdropFilter:'blur(4px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setAddingRow(null)}>
            <div className="card" style={{width:460,borderRadius:18,boxShadow:'0 20px 60px rgba(0,0,0,.2)',padding:24}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Add step · <span style={{color:streamColor(addingRow.stream)}}>{addingRow.stream}</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Step name</label>
                    <input className="ni" placeholder="e.g. User acceptance testing" value={newRow.name} onChange={e=>setNewRow({...newRow,name:e.target.value})} /></div>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Step #</label>
                    <input className="ni" placeholder="Auto" value={newRow.step} onChange={e=>setNewRow({...newRow,step:e.target.value})} /></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Start</label>
                    <input className="ni-date" type="date" style={{width:'100%'}} value={newRow.start} onChange={e=>setNewRow({...newRow,start:e.target.value})} /></div>
                  <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>End</label>
                    <input className="ni-date" type="date" style={{width:'100%'}} value={newRow.end} onChange={e=>setNewRow({...newRow,end:e.target.value})} /></div>
                </div>
                <div><label style={{fontSize:11,fontWeight:700,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Status</label>
                  <select className="ni" value={newRow.status} onChange={e=>setNewRow({...newRow,status:e.target.value})}>
                    {['Not started','In Progress','Done'].map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                  <button className="bg" onClick={()=>setAddingRow(null)}>Cancel</button>
                  <button className="bp" onClick={addCustomRow}>Add step</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gantt — hauteurs strictement identiques L et R */}
        {(() => {
          // ── Row height constants ──
          const H_HEADER = 38;   // "Steps" header + months header
          const H_STREAM = 38;   // CRM / iPaaS / Data Hub separator row
          const H_PARENT = 44;   // Step parent row
          const H_CHILD  = 36;   // Sub-step row

          // ── Build ordered flat list of visible rows (same loop, used for both sides) ──
          type GRow = { type:'stream'; stream:string } | { type:'row'; r:RoadmapStep; isParent:boolean };
          const flatRows: GRow[] = [];
          streamRows.forEach(s => {
            const sRows = visibleRows.filter(r => r.stream===s);
            if (!sRows.length) return;
            flatRows.push({ type:'stream', stream:s });
            sRows.forEach(r => {
              const isParent = r.isStep;
              const parentStep = r.step.split('.')[0];
              const parentRow = computedRows.find(x => x.stream===r.stream && x.isStep && x.step===parentStep);
              if (!isParent && (!parentRow || !expandedSteps.has(parentRow.id))) return;
              flatRows.push({ type:'row', r, isParent });
            });
          });

          const rowH = (g: GRow) => g.type==='stream' ? H_STREAM : (g.isParent ? H_PARENT : H_CHILD);

          return (
            <div className="card" style={{overflow:'hidden', userSelect:dragging?'none':'auto'}}>
              <div style={{display:'flex'}}>

                {/* ── LEFT: Label column ── */}
                <div style={{width:240, flexShrink:0, borderRight:`1px solid ${C.border}`}}>
                  {/* Header */}
                  <div style={{height:H_HEADER, borderBottom:`1px solid ${C.border}`, background:C.sectionBg, display:'flex', alignItems:'center', paddingLeft:14}}>
                    <span style={{fontSize:11, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.5px'}}>Steps</span>
                  </div>
                  {/* Rows */}
                  {flatRows.map((g, gi) => {
                    const h = rowH(g);
                    if (g.type==='stream') {
                      const color = streamColor(g.stream);
                      return (
                        <div key={`sl-${g.stream}`} style={{height:h, boxSizing:'border-box', padding:'0 14px', borderBottom:`1px solid ${C.border}`, background:color+'0d', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                          <div style={{display:'flex', alignItems:'center', gap:6}}>
                            <div style={{width:9, height:9, borderRadius:'50%', background:color}}/>
                            <span style={{fontSize:12, fontWeight:800, color, letterSpacing:'.3px'}}>{g.stream.toUpperCase()}</span>
                          </div>
                          <button onClick={()=>setAddingRow({stream:g.stream})} style={{background:'none', border:`1px dashed ${color}60`, borderRadius:6, padding:'2px 8px', fontSize:11, color, cursor:'pointer', fontWeight:600}}>+ Add</button>
                        </div>
                      );
                    }
                    const {r, isParent} = g;
                    const canExpand = computedRows.some(x => x.stream===r.stream && !x.isStep && x.step.startsWith(r.step+'.'));
                    const dotC = r.status==='Done'?'#34c759':r.status==='In Progress'?C.accent:C.textDim;
                    return (
                      <div key={`rl-${r.id}`}
                        style={{height:h, boxSizing:'border-box', padding:isParent?'0 14px':'0 14px 0 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'flex-start', gap:4, background:isParent?'#fff':C.bg, textAlign:'left'}}
                        onDoubleClick={e=>{e.stopPropagation(); openEdit(r);}}>
                        <span style={{fontSize:11, width:14, flexShrink:0, cursor:canExpand?'pointer':'default', userSelect:'none', color:canExpand?(expandedSteps.has(r.id)?C.accent:C.textMuted):'transparent'}}
                          onClick={e=>{e.stopPropagation(); if(canExpand) setExpandedSteps(prev=>{const n=new Set(prev); n.has(r.id)?n.delete(r.id):n.add(r.id); return n;});}}>
                          {canExpand ? (expandedSteps.has(r.id)?'▾':'▸') : ''}
                        </span>
                        <div style={{width:7, height:7, borderRadius:'50%', background:dotC, flexShrink:0}}/>
                        <span style={{fontSize:isParent?12:11, fontWeight:isParent?700:400, color:isParent?C.text:C.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}} title={r.name}>
                          {r.step}. {r.name}
                        </span>
                        <span style={{fontSize:12, color:C.textDim, cursor:'pointer', flexShrink:0, opacity:.35, transition:'opacity .15s'}}
                          onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='.35')}
                          onClick={e=>{e.stopPropagation(); openEdit(r);}}>✏</span>
                      </div>
                    );
                  })}
                </div>

                {/* ── RIGHT: Gantt bars ── */}
                <div ref={ganttRef} style={{flex:1, overflow:'hidden', position:'relative', cursor:dragging?(dragging.edge==='move'?'grabbing':'ew-resize'):'default'}}>
                  {/* Month header row — TODAY label sits here, clipped inside */}
                  <div style={{height:H_HEADER, borderBottom:`1px solid ${C.border}`, background:C.sectionBg, position:'relative', overflow:'hidden'}}>
                    {months.map((m,i) => (
                      <div key={i} style={{position:'absolute', left:`${m.pct}%`, top:0, bottom:0, borderLeft:i>0?`1px dashed ${C.border}`:'none', paddingLeft:5, display:'flex', alignItems:'center'}}>
                        <span style={{fontSize:10, fontWeight:700, color:C.textMuted}}>{m.label}</span>
                      </div>
                    ))}
                    {/* TODAY badge — inside header, won't overlap bars */}
                    <div style={{position:'absolute', top:0, bottom:0, left:`${todayPct}%`, width:2, background:C.danger+'70', pointerEvents:'none'}}/>
                    <div style={{position:'absolute', top:'50%', left:`${todayPct}%`, transform:'translate(-50%,-50%)', background:C.danger, color:'#fff', fontSize:9, fontWeight:800, padding:'3px 6px', borderRadius:5, pointerEvents:'none', whiteSpace:'nowrap', zIndex:5}}>TODAY</div>
                  </div>

                  {/* TODAY vertical line through all rows (starts after header) */}
                  <div style={{position:'absolute', top:H_HEADER, bottom:0, left:`${todayPct}%`, width:2, background:C.danger+'50', pointerEvents:'none', zIndex:8}}/>

                  {/* Month grid lines */}
                  {months.slice(1).map((m,i)=>(
                    <div key={i} style={{position:'absolute', top:H_HEADER, bottom:0, left:`${m.pct}%`, width:1, background:C.border+'70', pointerEvents:'none'}}/>
                  ))}

                  {/* Data rows — mirror flatRows exactly */}
                  {flatRows.map((g, gi) => {
                    const h = rowH(g);
                    if (g.type==='stream') {
                      const color = streamColor(g.stream);
                      return <div key={`sr-${g.stream}`} style={{height:h, borderBottom:`1px solid ${C.border}`, background:color+'05'}}/>;
                    }
                    const {r, isParent} = g;
                    const cs = r.start < '2026-01-01' ? '2026-01-01' : r.start > '2026-12-31' ? '2026-12-31' : r.start;
                    const ce = r.end > '2026-12-31' ? '2026-12-31' : r.end < '2026-01-01' ? '2026-01-01' : r.end;
                    const left = pct(cs); const right = pct(ce);
                    const width = Math.max(0.5, right-left);
                    const color = streamColor(r.stream);
                    const barColor = r.status==='Done'?'#34c759':r.status==='In Progress'?color:C.textDim;
                    const barH = isParent ? 18 : 10;
                    const barOpacity = r.status==='Not started'?0.28:0.9;
                    const isDraggingThis = dragging?.id===r.id;
                    return (
                      <div key={`rr-${r.id}`}
                        style={{height:h, borderBottom:`1px solid ${C.border}`, position:'relative', background:isParent?'#fff':C.bg}}
                        onMouseEnter={()=>setHoveredId(r.id)} onMouseLeave={()=>setHoveredId(null)}
                        onDoubleClick={e=>{e.stopPropagation(); openEdit(r);}}>
                        {/* Bar */}
                        <div style={{position:'absolute', top:'50%', left:`${left}%`, width:`${width}%`, transform:'translateY(-50%)', height:barH, borderRadius:barH/2, background:barColor, opacity:isDraggingThis?1:barOpacity, boxShadow:isDraggingThis?`0 0 0 2px ${barColor}`:'none', cursor:'grab', minWidth:6, transition:dragging?'none':'box-shadow .15s', zIndex:2}}
                          onMouseDown={e=>{ e.preventDefault(); setDragging({id:r.id, edge:'move', startX:e.clientX, origStart:r.start, origEnd:r.end}); }}>
                          <BarHandle side="start" id={r.id} r={r}/>
                          <BarHandle side="end" id={r.id} r={r}/>
                        </div>
                        {/* Tooltip */}
                        {hoveredId===r.id && !dragging && (
                          <div style={{position:'absolute', top:'100%', left:`${Math.min(left, 50)}%`, zIndex:30, background:'#1c1c1e', color:'#fff', borderRadius:10, padding:'8px 12px', fontSize:11, whiteSpace:'nowrap', pointerEvents:'none', boxShadow:'0 6px 20px rgba(0,0,0,.25)', marginTop:4}}>
                            <div style={{fontWeight:700, marginBottom:3}}>{r.stream} · Step {r.step}</div>
                            <div style={{opacity:.85}}>{r.name}</div>
                            <div style={{opacity:.6, marginTop:3}}>{fmtDate(r.start)} → {fmtDate(r.end)}</div>
                            <div style={{marginTop:3}}>
                              <span style={{padding:'1px 7px', borderRadius:10, background:r.status==='Done'?'#34c75930':r.status==='In Progress'?C.accent+'30':'#aaa2', color:r.status==='Done'?'#34c759':r.status==='In Progress'?C.accent:'#aaa', fontSize:10, fontWeight:600}}>{r.status}</span>
                            </div>
                            <div style={{opacity:.5, marginTop:4, fontSize:10}}>Double-click to edit · drag to move</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          );
        })()}
      </div>
    );
  };


  // ─── Stream View Content ───
  const StreamView = () => {
    const stream = activeStream;
    const isControlTower = stream === 'Control Tower';
    return (
      <>
        <QuickAdd stream={stream} />
        <Kanban stream={stream} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DecisionsList stream={stream} />
          <MeetingsList stream={stream} />
        </div>
        {isControlTower ? (
          <>
            <SectionLabel>Thursday Deck Prep</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ControlTowerBox storageKey="askVattenfall" title="Actions to ask Vattenfall" icon="📤" color={C.control} />
              <ControlTowerBox storageKey="keyMessages" title="Key messages for Thursday" icon="💡" color={C.datahub} />
            </div>
          </>
        ) : (
          <>
            <SectionLabel>Stream Management</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <StreamItemBox stream={stream} storageKey="toBeDiscussed" title="To be discussed" icon="💬" color={C.ipaas} />
              <StreamItemBox stream={stream} storageKey="potentialRisks" title="Potential risks" icon="⚠️" color={C.danger} />
            </div>
          </>
        )}
      </>
    );
  };

  // ─── Stream tab labels ───
  const streamLabel = (s: Stream) => s === 'Control Tower' ? '🎯 Control Tower' : `${streamEmoji(s)} ${s}`;

  // ─── Render ───
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text }}>
      <style>{CSS}</style>
      <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

      {/* Top Nav */}
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.3px', color: C.text }}>SUPER-NOVA</div>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 1 }}>Vattenfall · Project NOVA</div>
          </div>
          <div style={{ width: 1, height: 24, background: C.border }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginRight: 4 }}><b style={{ color: C.text }}>{totalTasks}</b> tasks</div>
            <div style={{ width: 1, height: 16, background: C.border }} />
            {(['CRM','iPaaS','Data Hub'] as Stream[]).map(s => {
              const hs = healthScore(s); const color = streamColor(s);
              const p0Alert = (data.tasks[s]||[]).filter(t => t.priority==='P0' && t.status!=='Done' && t.dueDate && t.dueDate < todayStr()).length;
              return (
                <div key={s} onClick={() => { setView('Streams'); setActiveStream(s); }}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background: C.bg, border:`1px solid ${C.border}`, cursor:'pointer', transition:'all .15s', position:'relative' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=color+'15'}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background=C.bg}>
                  {p0Alert > 0 && <div style={{ position:'absolute', top:-4, right:-4, width:14, height:14, borderRadius:'50%', background:C.danger, color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 2px #fff' }}>{p0Alert}</div>}
                  <div style={{ width:7, height:7, borderRadius:'50%', background:color }} />
                  <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{s === 'Data Hub' ? 'DHub' : s}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<button className="bg" style={{ fontSize: 12 }} onClick={handleExport}>↓ Export</button>
          <button className="bg" style={{ fontSize: 12 }} onClick={() => importRef.current?.click()}>↑ Import</button>
          <div style={{ display: 'flex', background: C.sectionBg, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, gap: 1 }}>
            {VIEWS.map(v => (
              <div key={v} onClick={() => setView(v)} className={view === v ? 'pill-active' : ''} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: view === v ? C.text : C.textMuted, transition: 'all .15s' }}>{v}</div>
            ))}
          </div>
        </div>
      </div>

      <DraftBar />
      {/* Stream Tabs */}
      {view === 'Streams' && (
        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', overflowX: 'auto' }}>
          {STREAMS.map(s => {
            const active = activeStream === s; const color = streamColor(s);
            return (
              <div key={s} onClick={() => setActiveStream(s)} style={{ padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: active ? color : C.textMuted, borderBottom: active ? `2px solid ${color}` : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all .15s', position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                {streamLabel(s)}
                {(() => { const p0 = (data.tasks[s]||[]).filter(t=>t.priority==='P0'&&t.status!=='Done'&&t.dueDate&&t.dueDate<todayStr()).length; return p0 > 0 ? <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:C.danger, borderRadius:10, padding:'1px 5px' }}>{p0}</span> : null; })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '22px 28px', maxWidth: 1400, margin: '0 auto' }}>
        {view === 'Streams' && <StreamView />}
        {view === 'Calendar' && <CalendarView />}
        {view === 'Weekly' && <WeeklyView />}
        {view === 'Roadmap' && <RoadmapView />}
      </div>

      {taskModal && <TaskModalView task={taskModal.task} stream={taskModal.stream} />}
      {meetingModal && <MeetingModalView meeting={meetingModal.meeting} stream={meetingModal.stream} />}
    </div>
  );
}
