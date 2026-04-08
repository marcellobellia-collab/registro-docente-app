import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderOpen,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';

const STORAGE_KEY = 'registro-docente-app-vite-v2';
const weekdays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const emptyData = {
  classes: [],
  schedule: [],
  lessons: [],
  tests: [],
  tasks: [],
};

function todayName() {
  const jsDay = new Date().getDay();
  const map = { 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì', 4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato', 0: 'Domenica' };
  return map[jsDay];
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT');
}

function sortByDateAsc(arr, field) {
  return [...arr].sort((a, b) => new Date(a[field]) - new Date(b[field]));
}

function sortByDateDesc(arr, field) {
  return [...arr].sort((a, b) => new Date(b[field]) - new Date(a[field]));
}

function normalizeImportedData(parsed) {
  return {
    classes: Array.isArray(parsed?.classes) ? parsed.classes : [],
    schedule: Array.isArray(parsed?.schedule)
      ? parsed.schedule.filter((item) => item?.day && item?.hour && item?.classId && item?.subject)
      : [],
    lessons: Array.isArray(parsed?.lessons)
      ? parsed.lessons.filter((item) => item?.classId && item?.date && item?.done && item?.next)
      : [],
    tests: Array.isArray(parsed?.tests)
      ? parsed.tests.filter((item) => item?.classId && item?.date && item?.type && item?.topic)
      : [],
    tasks: Array.isArray(parsed?.tasks)
      ? parsed.tasks.filter((item) => item?.title && item?.dueDate)
      : [],
  };
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registro-docente-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function badgeLabel(diffDays, completed) {
  if (completed) return 'Fatto';
  if (diffDays < 0) return `Scaduta da ${Math.abs(diffDays)} g`;
  if (diffDays === 0) return 'Oggi';
  return `Tra ${diffDays} g`;
}

function badgeClass(diffDays, completed) {
  if (completed) return 'badge badge-secondary';
  if (diffDays < 0) return 'badge badge-danger';
  return 'badge badge-secondary';
}

export default function App() {
  const [data, setData] = useState(emptyData);
  const [tab, setTab] = useState('oggi');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [quickClassId, setQuickClassId] = useState('');
  const [quickDone, setQuickDone] = useState('');
  const [quickNext, setQuickNext] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [showOnlyOpenTasks, setShowOnlyOpenTasks] = useState(true);

  const [classNameInput, setClassNameInput] = useState('');
  const [scheduleForm, setScheduleForm] = useState({ day: 'Lunedì', hour: '', classId: '', subject: '' });
  const [lessonForm, setLessonForm] = useState({ classId: '', date: new Date().toISOString().slice(0, 10), done: '', next: '', notes: '' });
  const [testForm, setTestForm] = useState({ classId: '', date: '', type: 'Scritta', topic: '', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '', classId: '', context: '', notes: '' });

  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingTestId, setEditingTestId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setData(normalizeImportedData(JSON.parse(raw)));
      } catch {
        setData(emptyData);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!quickClassId && data.classes[0]?.id) setQuickClassId(data.classes[0].id);
    setScheduleForm((prev) => ({ ...prev, classId: prev.classId || data.classes[0]?.id || '' }));
    setLessonForm((prev) => ({ ...prev, classId: prev.classId || data.classes[0]?.id || '' }));
    setTestForm((prev) => ({ ...prev, classId: prev.classId || data.classes[0]?.id || '' }));
  }, [data.classes, quickClassId]);

  const classMap = useMemo(() => Object.fromEntries(data.classes.map((c) => [c.id, c.name])), [data.classes]);
  const todaySchedule = useMemo(() => data.schedule.filter((s) => s.day === todayName()).sort((a, b) => a.hour.localeCompare(b.hour)), [data.schedule]);
  const upcomingTests = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sortByDateAsc(data.tests.filter((t) => new Date(t.date) >= today), 'date').slice(0, 6);
  }, [data.tests]);

  const urgentTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sortByDateAsc(
      (data.tasks || [])
        .filter((task) => !task.completed)
        .map((task) => {
          const due = new Date(task.dueDate);
          due.setHours(0, 0, 0, 0);
          return { ...task, diffDays: Math.floor((due - today) / 86400000) };
        }),
      'dueDate'
    ).slice(0, 8);
  }, [data.tasks]);

  const topUrgentTask = urgentTasks[0] || null;
  const todayTaskCount = urgentTasks.filter((t) => t.diffDays === 0).length;
  const overdueTaskCount = urgentTasks.filter((t) => t.diffDays < 0).length;
  const visibleTasks = useMemo(() => {
    const base = sortByDateAsc(data.tasks || [], 'dueDate');
    return showOnlyOpenTasks ? base.filter((task) => !task.completed) : base;
  }, [data.tasks, showOnlyOpenTasks]);

  const selectedClassLessons = useMemo(() => {
    if (selectedClassId === 'all') return sortByDateDesc(data.lessons, 'date');
    return sortByDateDesc(data.lessons.filter((l) => l.classId === selectedClassId), 'date');
  }, [data.lessons, selectedClassId]);

  const selectedClassTests = useMemo(() => {
    if (selectedClassId === 'all') return sortByDateAsc(data.tests, 'date');
    return sortByDateAsc(data.tests.filter((t) => t.classId === selectedClassId), 'date');
  }, [data.tests, selectedClassId]);

  const latestLessonByClass = useMemo(() => {
    const result = {};
    data.classes.forEach((c) => {
      result[c.id] = sortByDateDesc(data.lessons.filter((l) => l.classId === c.id), 'date')[0] || null;
    });
    return result;
  }, [data.classes, data.lessons]);

  function addClass() {
    const name = classNameInput.trim();
    if (!name) return;
    setData((prev) => ({ ...prev, classes: [...prev.classes, { id: crypto.randomUUID(), name }] }));
    setClassNameInput('');
  }

  function deleteClass(id) {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== id),
      schedule: prev.schedule.filter((s) => s.classId !== id),
      lessons: prev.lessons.filter((l) => l.classId !== id),
      tests: prev.tests.filter((t) => t.classId !== id),
      tasks: (prev.tasks || []).filter((t) => t.classId !== id),
    }));
  }

  function addSchedule() {
    if (!scheduleForm.hour || !scheduleForm.classId || !scheduleForm.subject) return;
    setData((prev) => ({ ...prev, schedule: [{ id: crypto.randomUUID(), ...scheduleForm }, ...prev.schedule] }));
    setScheduleForm((prev) => ({ ...prev, hour: '', subject: '' }));
  }

  function addLesson(payload = lessonForm) {
    if (!payload.classId || !payload.date || !payload.done || !payload.next) return;
    setData((prev) => ({ ...prev, lessons: [{ id: crypto.randomUUID(), ...payload }, ...prev.lessons] }));
    setLessonForm((prev) => ({ ...prev, done: '', next: '', notes: '' }));
  }

  function addTest() {
    if (!testForm.classId || !testForm.date || !testForm.topic) return;
    setData((prev) => ({ ...prev, tests: [{ id: crypto.randomUUID(), ...testForm }, ...prev.tests] }));
    setTestForm((prev) => ({ ...prev, date: '', topic: '', notes: '' }));
  }

  function addTask() {
    if (!taskForm.title || !taskForm.dueDate) return;
    setData((prev) => ({ ...prev, tasks: [{ id: crypto.randomUUID(), completed: false, ...taskForm }, ...(prev.tasks || [])] }));
    setTaskForm({ title: '', dueDate: '', classId: '', context: '', notes: '' });
  }

  function removeItem(section, id) {
    setData((prev) => ({ ...prev, [section]: prev[section].filter((item) => item.id !== id) }));
  }

  function updateItem(section, id, patch) {
    setData((prev) => ({ ...prev, [section]: prev[section].map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  function saveQuickLesson() {
    if (!quickClassId || !quickDone || !quickNext) return;
    addLesson({ classId: quickClassId, date: new Date().toISOString().slice(0, 10), done: quickDone, next: quickNext, notes: quickNotes });
    setQuickDone('');
    setQuickNext('');
    setQuickNotes('');
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result);
        setData(normalizeImportedData(parsed));
      } catch {
        alert('Impossibile leggere il file.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero">
          <div>
            <h1>Registro docente</h1>
            <p>Orario, lezioni, verifiche, scadenze e promemoria personali.</p>
          </div>
          <div className="hero-actions">
            <span className="badge badge-secondary">Salvataggio locale automatico</span>
            <button className="btn btn-outline" onClick={() => setData(emptyData)}>Reset dati</button>
          </div>
        </div>

        {topUrgentTask && (
          <section className="card alert-card">
            <div className="card-body">
              <div className="alert-row">
                <ShieldAlert size={20} />
                <div>
                  <div className="muted small">Promemoria principale</div>
                  <div className="title-row">{topUrgentTask.title}</div>
                  <div className="muted small">{topUrgentTask.diffDays < 0 ? `Scaduta da ${Math.abs(topUrgentTask.diffDays)} giorni` : topUrgentTask.diffDays === 0 ? 'Da fare oggi' : `Da fare entro ${formatDate(topUrgentTask.dueDate)}`}</div>
                  {topUrgentTask.context && <div className="small mt-1">{topUrgentTask.context}</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-body filters-row">
            <div>
              <div className="label">Filtro rapido per classe</div>
              <select className="input" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                <option value="all">Tutte le classi</option>
                {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-outline" onClick={() => downloadJson(data)}><Archive size={16} /> Backup dati</button>
            <label className="btn btn-outline file-btn">
              <Upload size={16} /> Importa dati
              <input type="file" accept="application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importJsonFile(file); e.target.value = ''; }} />
            </label>
          </div>
        </section>

        <div className="stats-grid">
          <StatCard label="Scadenze per oggi" value={todayTaskCount} />
          <StatCard label="Scadenze già passate" value={overdueTaskCount} />
          <StatCard label="Urgenti aperte" value={urgentTasks.length} />
        </div>

        <div className="tabs">
          {['oggi','classi','orario','lezioni','verifiche','scadenze','classe'].map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{labelForTab(t)}</button>
          ))}
        </div>

        {tab === 'oggi' && (
          <div className="space-y">
            <section className="card">
              <div className="card-header"><h2>Inserimento rapido da iPhone</h2></div>
              <div className="card-body">
                <div className="form-grid four">
                  <select className="input" value={quickClassId} onChange={(e) => setQuickClassId(e.target.value)}>
                    <option value="">Classe</option>
                    {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input className="input" value={quickDone} onChange={(e) => setQuickDone(e.target.value)} placeholder="Ultima cosa fatta" />
                  <input className="input" value={quickNext} onChange={(e) => setQuickNext(e.target.value)} placeholder="Prossima volta" />
                  <input className="input" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} placeholder="Note rapide" />
                </div>
                <div className="mt-3"><button className="btn" onClick={saveQuickLesson}><Save size={16} /> Salva lezione di oggi</button></div>
              </div>
            </section>

            <div className="main-grid">
              <section className="card col-span-2">
                <div className="card-header"><h2><Clock3 size={18} /> Oggi: {todayName()}</h2></div>
                <div className="card-body stack">
                  {todaySchedule.length === 0 ? <p className="muted">Nessuna ora prevista per oggi.</p> : todaySchedule.map((item) => {
                    const latest = latestLessonByClass[item.classId];
                    return (
                      <div key={item.id} className="inner-card">
                        <div className="row-between">
                          <div>
                            <div className="title-row">{classMap[item.classId] || 'Classe'}</div>
                            <div className="muted small">{item.hour} · {item.subject}</div>
                          </div>
                          <span className="badge">{item.day}</span>
                        </div>
                        <div className="two-col mt-3">
                          <InfoBox title="Ultima cosa fatta" text={latest?.done || 'Non ancora inserita'} />
                          <InfoBox title="Da fare la prossima volta" text={latest?.next || 'Non ancora inserito'} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="stack">
                <section className="card">
                  <div className="card-header"><h2><CalendarDays size={18} /> Verifiche in arrivo</h2></div>
                  <div className="card-body stack">
                    {upcomingTests.length === 0 ? <p className="muted">Nessuna verifica programmata.</p> : upcomingTests.map((test) => (
                      <div key={test.id} className="soft-card">
                        <div className="row-between"><div className="title-row small-title">{classMap[test.classId]}</div><span className="badge badge-outline">{test.type}</span></div>
                        <div className="muted small mt-1">{formatDate(test.date)}</div>
                        <div className="small mt-1">{test.topic}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="card">
                  <div className="card-header"><h2><BellRing size={18} /> Da fare urgente</h2></div>
                  <div className="card-body stack">
                    {urgentTasks.length === 0 ? <p className="muted">Nessuna scadenza urgente.</p> : urgentTasks.map((task) => (
                      <div key={task.id} className="soft-card">
                        <div className="row-between"><div className="title-row small-title">{task.title}</div><span className={badgeClass(task.diffDays, false)}>{badgeLabel(task.diffDays, false)}</span></div>
                        <div className="muted small mt-1">Entro il {formatDate(task.dueDate)}</div>
                        {task.context && <div className="small mt-1">{task.context}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {tab === 'classi' && (
          <div className="main-grid left-form">
            <section className="card sticky-card">
              <div className="card-header"><h2>Nuova classe</h2></div>
              <div className="card-body stack">
                <input className="input" value={classNameInput} onChange={(e) => setClassNameInput(e.target.value)} placeholder="Es. 2B Classico" />
                <button className="btn" onClick={addClass}><Plus size={16} /> Aggiungi classe</button>
              </div>
            </section>
            <div className="cards-grid">
              {data.classes.map((c) => {
                const lessons = sortByDateDesc(data.lessons.filter((l) => l.classId === c.id), 'date');
                const latest = lessons[0];
                return (
                  <section key={c.id} className="card">
                    <div className="card-header row-between">
                      <div>
                        <h2>{c.name}</h2>
                        <div className="muted small">{lessons.length} lezioni registrate</div>
                      </div>
                      <button className="icon-btn" onClick={() => deleteClass(c.id)}><Trash2 size={16} /></button>
                    </div>
                    <div className="card-body stack">
                      <InfoBox title="Ultima lezione" text={`${latest ? formatDate(latest.date) : '—'}${latest?.done ? ` — ${latest.done}` : ''}`} />
                      <InfoBox title="Prossima volta" text={latest?.next || 'Non indicato'} />
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'orario' && (
          <TwoPanel
            left={<section className="card sticky-card"><div className="card-header"><h2>Aggiungi ora</h2></div><div className="card-body stack"><select className="input" value={scheduleForm.day} onChange={(e) => setScheduleForm((p) => ({ ...p, day: e.target.value }))}>{weekdays.map((d) => <option key={d} value={d}>{d}</option>)}</select><input className="input" value={scheduleForm.hour} onChange={(e) => setScheduleForm((p) => ({ ...p, hour: e.target.value }))} placeholder="Es. 10:00-11:00" /><select className="input" value={scheduleForm.classId} onChange={(e) => setScheduleForm((p) => ({ ...p, classId: e.target.value }))}><option value="">Classe</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" value={scheduleForm.subject} onChange={(e) => setScheduleForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Materia" /><button className="btn" onClick={addSchedule}><Plus size={16} /> Salva ora</button></div></section>}
            right={<section className="card"><div className="card-header"><h2><BookOpen size={18} /> Orario settimanale</h2></div><div className="card-body weekday-grid">{weekdays.map((day) => { const items = data.schedule.filter((s) => s.day === day).sort((a,b)=>a.hour.localeCompare(b.hour)); return <div key={day} className="day-card"><div className="title-row">{day}</div><div className="stack mt-2">{items.length===0?<div className="muted small">Nessuna ora</div>:items.map((item)=><EditableSchedule key={item.id} item={item} classNameLabel={classMap[item.classId]} classes={data.classes} editing={editingScheduleId===item.id} onEdit={()=>setEditingScheduleId(item.id)} onCancel={()=>setEditingScheduleId(null)} onSave={(patch)=>{updateItem('schedule', item.id, patch); setEditingScheduleId(null);}} onDelete={()=>removeItem('schedule', item.id)} />)}</div></div>; })}</div></section>}
          />
        )}

        {tab === 'lezioni' && (
          <TwoPanel
            left={<section className="card sticky-card"><div className="card-header"><h2>Nuova lezione</h2></div><div className="card-body stack"><select className="input" value={lessonForm.classId} onChange={(e) => setLessonForm((p) => ({ ...p, classId: e.target.value }))}><option value="">Classe</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="date" className="input" value={lessonForm.date} onChange={(e) => setLessonForm((p) => ({ ...p, date: e.target.value }))} /><textarea className="input textarea" value={lessonForm.done} onChange={(e) => setLessonForm((p) => ({ ...p, done: e.target.value }))} placeholder="Cosa hai fatto oggi" /><textarea className="input textarea" value={lessonForm.next} onChange={(e) => setLessonForm((p) => ({ ...p, next: e.target.value }))} placeholder="Cosa fare la prossima volta" /><textarea className="input textarea small-textarea" value={lessonForm.notes} onChange={(e) => setLessonForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note aggiuntive" /><button className="btn" onClick={() => addLesson()}><Plus size={16} /> Salva lezione</button></div></section>}
            right={<section className="card"><div className="card-header"><h2><ClipboardList size={18} /> Diario lezioni</h2></div><div className="card-body stack">{selectedClassLessons.length===0?<p className="muted">Nessuna lezione registrata.</p>:selectedClassLessons.map((lesson)=><EditableLesson key={lesson.id} lesson={lesson} classNameLabel={classMap[lesson.classId]} editing={editingLessonId===lesson.id} onEdit={()=>setEditingLessonId(lesson.id)} onCancel={()=>setEditingLessonId(null)} onSave={(patch)=>{updateItem('lessons', lesson.id, patch); setEditingLessonId(null);}} onDelete={()=>removeItem('lessons', lesson.id)} />)}</div></section>}
          />
        )}

        {tab === 'verifiche' && (
          <TwoPanel
            left={<section className="card sticky-card"><div className="card-header"><h2>Nuova verifica</h2></div><div className="card-body stack"><select className="input" value={testForm.classId} onChange={(e) => setTestForm((p) => ({ ...p, classId: e.target.value }))}><option value="">Classe</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="date" className="input" value={testForm.date} onChange={(e) => setTestForm((p) => ({ ...p, date: e.target.value }))} /><select className="input" value={testForm.type} onChange={(e) => setTestForm((p) => ({ ...p, type: e.target.value }))}><option>Scritta</option><option>Orale</option></select><textarea className="input textarea" value={testForm.topic} onChange={(e) => setTestForm((p) => ({ ...p, topic: e.target.value }))} placeholder="Argomento della verifica" /><textarea className="input textarea small-textarea" value={testForm.notes} onChange={(e) => setTestForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note" /><button className="btn" onClick={addTest}><Plus size={16} /> Salva verifica</button></div></section>}
            right={<section className="card"><div className="card-header"><h2><CheckCircle2 size={18} /> Calendario verifiche</h2></div><div className="card-body stack">{selectedClassTests.length===0?<p className="muted">Nessuna verifica registrata.</p>:selectedClassTests.map((test)=><EditableTest key={test.id} test={test} classNameLabel={classMap[test.classId]} editing={editingTestId===test.id} onEdit={()=>setEditingTestId(test.id)} onCancel={()=>setEditingTestId(null)} onSave={(patch)=>{updateItem('tests', test.id, patch); setEditingTestId(null);}} onDelete={()=>removeItem('tests', test.id)} />)}</div></section>}
          />
        )}

        {tab === 'scadenze' && (
          <TwoPanel
            left={<section className="card sticky-card"><div className="card-header"><h2>Nuova scadenza</h2></div><div className="card-body stack"><input className="input" value={taskForm.title} onChange={(e)=>setTaskForm((p)=>({...p,title:e.target.value}))} placeholder="Es. Correggere compito di recupero di Caio" /><input type="date" className="input" value={taskForm.dueDate} onChange={(e)=>setTaskForm((p)=>({...p,dueDate:e.target.value}))} /><select className="input" value={taskForm.classId} onChange={(e)=>setTaskForm((p)=>({...p,classId:e.target.value}))}><option value="">Generale</option>{data.classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" value={taskForm.context} onChange={(e)=>setTaskForm((p)=>({...p,context:e.target.value}))} placeholder="Es. Mail a tizio / interrogare Sempronio" /><textarea className="input textarea small-textarea" value={taskForm.notes} onChange={(e)=>setTaskForm((p)=>({...p,notes:e.target.value}))} placeholder="Note aggiuntive" /><button className="btn" onClick={addTask}><Plus size={16} /> Salva scadenza</button></div></section>}
            right={<section className="card"><div className="card-header row-between"><h2><AlertTriangle size={18} /> Tutte le scadenze e cose da fare</h2><div className="btn-row"><button className={`btn btn-sm ${showOnlyOpenTasks?'':'btn-outline'}`} onClick={()=>setShowOnlyOpenTasks(true)}>Aperte</button><button className={`btn btn-sm ${!showOnlyOpenTasks?'':'btn-outline'}`} onClick={()=>setShowOnlyOpenTasks(false)}>Tutte</button></div></div><div className="card-body stack">{visibleTasks.length===0?<p className="muted">Nessuna scadenza registrata.</p>:visibleTasks.map((task)=><EditableTask key={task.id} task={task} classNameLabel={task.classId ? classMap[task.classId] : 'Generale'} editing={editingTaskId===task.id} onEdit={()=>setEditingTaskId(task.id)} onCancel={()=>setEditingTaskId(null)} onSave={(patch)=>{updateItem('tasks', task.id, patch); setEditingTaskId(null);}} onDelete={()=>removeItem('tasks', task.id)} onToggleCompleted={()=>updateItem('tasks', task.id, { completed: !task.completed })} />)}</div></section>}
          />
        )}

        {tab === 'classe' && (
          <section className="card"><div className="card-header"><h2><FolderOpen size={18} /> Vista per singola classe</h2></div><div className="card-body">{selectedClassId === 'all' ? <p className="muted">Seleziona una classe dal filtro in alto per vedere un riepilogo dedicato.</p> : <div className="class-view-grid"><div className="stack"><InfoBox title="Classe" text={classMap[selectedClassId]} /><InfoBox title="Ultima lezione" text={`${latestLessonByClass[selectedClassId] ? formatDate(latestLessonByClass[selectedClassId].date) : '—'}${latestLessonByClass[selectedClassId]?.done ? ` — ${latestLessonByClass[selectedClassId].done}` : ''}`} /><InfoBox title="Prossima volta" text={latestLessonByClass[selectedClassId]?.next || 'Non indicato'} /></div><div><div className="title-row mb-2">Storico lezioni</div><div className="scroll-box">{selectedClassLessons.length===0?<p className="muted">Nessuna lezione per questa classe.</p>:selectedClassLessons.map((lesson)=><div key={lesson.id} className="soft-card"><div className="muted small">{formatDate(lesson.date)}</div><div className="small-title mt-1">Fatto</div><div className="small">{lesson.done}</div><div className="small-title mt-2">Prossima volta</div><div className="small">{lesson.next}</div></div>)}</div></div><div><div className="title-row mb-2">Verifiche</div><div className="scroll-box">{selectedClassTests.length===0?<p className="muted">Nessuna verifica per questa classe.</p>:selectedClassTests.map((test)=><div key={test.id} className="soft-card"><div className="row-between"><div className="muted small">{formatDate(test.date)}</div><span className="badge badge-outline">{test.type}</span></div><div className="small mt-2">{test.topic}</div>{test.notes && <div className="muted small mt-2">{test.notes}</div>}</div>)}</div></div></div>}</div></section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return <section className="card"><div className="card-body"><div className="muted small">{label}</div><div className="stat-value">{value}</div></div></section>;
}

function TwoPanel({ left, right }) {
  return <div className="main-grid left-form">{left}{right}</div>;
}

function InfoBox({ title, text }) {
  return <div className="info-box"><div className="small-title mb-1">{title}</div><div className="small">{text}</div></div>;
}

function labelForTab(tab) {
  return {
    oggi: 'Oggi',
    classi: 'Classi',
    orario: 'Orario',
    lezioni: 'Lezioni',
    verifiche: 'Verifiche',
    scadenze: 'Scadenze',
    classe: 'Vista classe',
  }[tab];
}

function EditableSchedule({ item, classNameLabel, classes, editing, onEdit, onCancel, onSave, onDelete }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => setDraft(item), [item, editing]);
  if (editing) {
    return <div className="inner-card stack"><select className="input" value={draft.day} onChange={(e)=>setDraft({...draft, day:e.target.value})}>{weekdays.map((d)=><option key={d} value={d}>{d}</option>)}</select><input className="input" value={draft.hour} onChange={(e)=>setDraft({...draft, hour:e.target.value})} /><select className="input" value={draft.classId} onChange={(e)=>setDraft({...draft, classId:e.target.value})}>{classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input" value={draft.subject} onChange={(e)=>setDraft({...draft, subject:e.target.value})} /><div className="btn-row"><button className="btn btn-sm" onClick={()=>onSave(draft)}><Save size={16} /> Salva</button><button className="btn btn-outline btn-sm" onClick={onCancel}><X size={16} /> Annulla</button></div></div>;
  }
  return <div className="inner-card"><div className="row-between"><div><div className="title-row small-title">{item.hour}</div><div className="small">{classNameLabel}</div><div className="muted small">{item.subject}</div></div><div className="btn-row"><button className="icon-btn" onClick={onEdit}><Pencil size={16} /></button><button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button></div></div></div>;
}

function EditableLesson({ lesson, classNameLabel, editing, onEdit, onCancel, onSave, onDelete }) {
  const [draft, setDraft] = useState(lesson);
  useEffect(() => setDraft(lesson), [lesson, editing]);
  if (editing) {
    return <div className="inner-card stack"><div className="small-title">{classNameLabel}</div><input type="date" className="input" value={draft.date} onChange={(e)=>setDraft({...draft, date:e.target.value})} /><textarea className="input textarea" value={draft.done} onChange={(e)=>setDraft({...draft, done:e.target.value})} /><textarea className="input textarea" value={draft.next} onChange={(e)=>setDraft({...draft, next:e.target.value})} /><textarea className="input textarea small-textarea" value={draft.notes || ''} onChange={(e)=>setDraft({...draft, notes:e.target.value})} /><div className="btn-row"><button className="btn btn-sm" onClick={()=>onSave(draft)}><Save size={16} /> Salva</button><button className="btn btn-outline btn-sm" onClick={onCancel}><X size={16} /> Annulla</button></div></div>;
  }
  return <div className="inner-card"><div className="row-between"><div><div className="title-row">{classNameLabel}</div><div className="muted small">{formatDate(lesson.date)}</div></div><div className="btn-row"><button className="icon-btn" onClick={onEdit}><Pencil size={16} /></button><button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button></div></div><div className="two-col mt-3"><InfoBox title="Fatto" text={lesson.done} /><InfoBox title="Prossima volta" text={lesson.next} /></div>{lesson.notes && <div className="info-box mt-3"><div className="small-title mb-1">Note</div><div className="small">{lesson.notes}</div></div>}</div>;
}

function EditableTest({ test, classNameLabel, editing, onEdit, onCancel, onSave, onDelete }) {
  const [draft, setDraft] = useState(test);
  useEffect(() => setDraft(test), [test, editing]);
  if (editing) {
    return <div className="inner-card stack"><div className="small-title">{classNameLabel}</div><input type="date" className="input" value={draft.date} onChange={(e)=>setDraft({...draft, date:e.target.value})} /><select className="input" value={draft.type} onChange={(e)=>setDraft({...draft, type:e.target.value})}><option>Scritta</option><option>Orale</option></select><textarea className="input textarea" value={draft.topic} onChange={(e)=>setDraft({...draft, topic:e.target.value})} /><textarea className="input textarea small-textarea" value={draft.notes || ''} onChange={(e)=>setDraft({...draft, notes:e.target.value})} /><div className="btn-row"><button className="btn btn-sm" onClick={()=>onSave(draft)}><Save size={16} /> Salva</button><button className="btn btn-outline btn-sm" onClick={onCancel}><X size={16} /> Annulla</button></div></div>;
  }
  return <div className="inner-card"><div className="row-between"><div><div className="title-row">{classNameLabel}</div><div className="muted small">{formatDate(test.date)}</div></div><div className="btn-row"><span className="badge badge-outline">{test.type}</span><button className="icon-btn" onClick={onEdit}><Pencil size={16} /></button><button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button></div></div><div className="small mt-3">{test.topic}</div>{test.notes && <div className="muted small mt-2">{test.notes}</div>}</div>;
}

function EditableTask({ task, classNameLabel, editing, onEdit, onCancel, onSave, onDelete, onToggleCompleted }) {
  const [draft, setDraft] = useState(task);
  useEffect(() => setDraft(task), [task, editing]);
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(task.dueDate); due.setHours(0,0,0,0);
  const diffDays = Math.floor((due - today) / 86400000);
  if (editing) {
    return <div className="inner-card stack"><input className="input" value={draft.title} onChange={(e)=>setDraft({...draft, title:e.target.value})} /><input type="date" className="input" value={draft.dueDate} onChange={(e)=>setDraft({...draft, dueDate:e.target.value})} /><input className="input" value={draft.context || ''} onChange={(e)=>setDraft({...draft, context:e.target.value})} placeholder="Contesto o persona" /><textarea className="input textarea small-textarea" value={draft.notes || ''} onChange={(e)=>setDraft({...draft, notes:e.target.value})} /><div className="btn-row"><button className="btn btn-sm" onClick={()=>onSave(draft)}><Save size={16} /> Salva</button><button className="btn btn-outline btn-sm" onClick={onCancel}><X size={16} /> Annulla</button></div></div>;
  }
  return <div className={`inner-card ${task.completed ? 'task-done' : ''}`}><div className="row-between"><div><div className="title-row">{task.title}</div><div className="btn-row mt-1"><span className="badge badge-outline">{classNameLabel}</span><span className={badgeClass(diffDays, task.completed)}>{badgeLabel(diffDays, task.completed)}</span></div><div className="muted small mt-1">Entro il {formatDate(task.dueDate)}</div>{task.context && <div className="small mt-2">{task.context}</div>}{task.notes && <div className="muted small mt-2">{task.notes}</div>}</div><div className="btn-row"><button className="btn btn-outline btn-sm" onClick={onToggleCompleted}>{task.completed ? 'Riapri' : 'Fatto'}</button><button className="icon-btn" onClick={onEdit}><Pencil size={16} /></button><button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button></div></div></div>;
}
