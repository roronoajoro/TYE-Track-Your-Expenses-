import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { useApi } from "../hooks/useApi";
import "./Dashboard.css";

const COLORS = ["#e8b84b","#7c6af7","#2dd4bf","#ff6b6b","#4ade80","#f97316","#ec4899","#60a5fa"];
const CAT_META = {
  Food:{icon:"🍜",accent:"#f97316"}, Transport:{icon:"🚌",accent:"#3b82f6"},
  Shopping:{icon:"🛍️",accent:"#a855f7"}, Utilities:{icon:"⚡",accent:"#ef4444"},
  Entertainment:{icon:"🎬",accent:"#06b6d4"}, Rent:{icon:"🏠",accent:"#eab308"},
  Other:{icon:"📦",accent:"#6b7280"}
};
const ICON_MAP = [
  {keys:["food","eat","lunch","dinner","breakfast","restaurant","snack","meal","grocery"],icon:"🍜"},
  {keys:["transport","bus","uber","ride","taxi","cng","rickshaw","fuel","petrol"],icon:"🚌"},
  {keys:["rent","house","flat","bari","home","apartment"],icon:"🏠"},
  {keys:["utility","electric","electricity","bill","water","internet","wifi","phone"],icon:"⚡"},
  {keys:["shopping","shop","clothes","dress","shoes","fashion","buy","mall"],icon:"🛍️"},
  {keys:["entertainment","netflix","movie","cinema","game","gaming"],icon:"🎬"},
  {keys:["health","medicine","doctor","hospital","pharmacy"],icon:"💊"},
  {keys:["gym","fitness","workout","sport"],icon:"💪"},
  {keys:["education","school","college","tuition","book"],icon:"📚"},
  {keys:["travel","trip","flight","hotel","vacation"],icon:"✈️"},
  {keys:["coffee","cafe","tea"],icon:"☕"},
];
function getIcon(cat){const l=cat.toLowerCase();for(const e of ICON_MAP)if(e.keys.some(k=>l.includes(k)))return e.icon;return"📦";}
function cm(cat){return CAT_META[cat]||{icon:getIcon(cat),accent:"#6b7280"};}
const DEF_CATS = ["Food","Transport","Rent","Utilities","Shopping","Entertainment"];
const TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

// Timezone-safe YYYY-MM
function toYM(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function getLast24Months(){
  const months=[];const today=new Date();
  for(let i=0;i<24;i++){
    const d=new Date(today.getFullYear(),today.getMonth()-i,1);
    months.push({value:toYM(d),display:d.toLocaleDateString("en-US",{year:"numeric",month:"long"})});
  }
  return months;
}
function monthLabel(ym){
  const f=getLast24Months().find(m=>m.value===ym);
  if(f)return f.display;
  const[y,m]=ym.split("-").map(Number);
  return new Date(y,m-1,1).toLocaleDateString("en-US",{year:"numeric",month:"long"});
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,.8)"}}>
      <div style={{marginBottom:4,color:"rgba(255,255,255,.5)"}}>{label}</div>
      <div style={{fontWeight:700,color:"#e8b84b"}}>৳{payload[0].value.toLocaleString()}</div>
    </div>
  );
  return null;
};

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast(){
  const [toast,setToast]=useState(null);
  const show=useCallback((msg,type="ok")=>{
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  },[]);
  return{toast,show};
}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [hiddenMonths, setHiddenMonths] = useState([]);
  const [dashMonth, setDashMonth] = useState(() => toYM(new Date()));
  const TODAY_YM = toYM(new Date());

  const {toast,show} = useToast();
  const [editTx, setEditTx]         = useState(null); // transaction being edited
  const [editBudget, setEditBudget] = useState(null); // budget being edited

  const {
    transactions, budgets, summary,
    savings, cats, setSavings, setCats,
    fetchTransactions, fetchSummary, fetchBudgets, fetchMonthlyReport,
    addTransaction, deleteTransaction, updateTransaction,
    createBudget, deleteBudget, updateBudget,
  } = useApi(user.id);

  // Re-fetch when dashMonth changes
  const switchMonth = useCallback(async (m) => {
    setDashMonth(m);
    await fetchSummary(m);
    await fetchBudgets(m);
  }, [fetchSummary, fetchBudgets]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const now = new Date();
  const thisMonth = toYM(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = toYM(lastMonthDate);

  const thisTxs = useMemo(() => transactions.filter(t => t.date?.startsWith(dashMonth)), [transactions, dashMonth]);
  const lastTxs = useMemo(() => transactions.filter(t => t.date?.startsWith(lastMonth)), [transactions, lastMonth]);
  const breakdown = summary.breakdown || {};
  const monthly = useMemo(() => {
    const map={};
    transactions.forEach(t=>{if(t.date){const k=t.date.slice(0,7);map[k]=(map[k]||0)+t.amount;}});
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
      .filter(([k])=>!hiddenMonths.includes(k))
      .map(([k,amount])=>({month:new Date(k+"-02").toLocaleString("en-US",{month:"short"}),amount,key:k}));
  }, [transactions, hiddenMonths]);

  const total = summary.total_spent || 0;
  const lastTotal = lastTxs.reduce((s,t)=>s+t.amount, 0);
  const diff = lastTotal ? ((total-lastTotal)/lastTotal*100).toFixed(1) : null;
  const avg = thisTxs.length ? (total/thisTxs.length).toFixed(0) : 0;

  function bStatus(b){const spent=breakdown[b.category]||0;const pct=Math.min((spent/b.monthly_limit)*100,100);return{spent,pct,isOver:spent>b.monthly_limit,isNear:pct>=b.alert_threshold};}
  function bColor(s){return s.isOver?"#ff6b6b":s.isNear?"#f97316":"#e8b84b";}
  const overB = budgets.filter(b=>{const s=bStatus(b);return s.isOver||s.isNear;});
  const pieData = Object.entries(breakdown).map(([name,value])=>({name,value}));
  const barData = Object.entries(breakdown).map(([name,value])=>({name,value}));
  const today = `${thisMonth}-${now.getDate().toString().padStart(2,"0")}`;

  // ── Tab config ─────────────────────────────────────────────────────────────
  const TABS = [["dashboard","▣ Dashboard"],["transactions","≡ Transactions"],["budgets","◎ Budgets"],["analytics","◆ Analytics"],["savings","◈ Goals"],["categories","⊞ Categories"]];
  const SB_TABS = [["dashboard","▣","Dashboard"],["transactions","≡","Transactions"],["budgets","◎","Budgets"],["analytics","◆","Analytics"],["savings","◈","Savings Goals"],["categories","⊞","Categories"]];

  // ── Sub-components ─────────────────────────────────────────────────────────
  function EmptyState({icon,title,sub,action,actionLabel}){
    return <div className="d-empty"><div className="d-empty-ico">{icon}</div><div className="d-empty-title">{title}</div><div className="d-empty-sub">{sub}</div>{action&&<button className="btn-dash-p" onClick={action}>{actionLabel}</button>}</div>;
  }

  function TxRow({t}){
    return (
      <div className="d-tx">
        <div className="d-tx-ico">{cm(t.category).icon}</div>
        <div className="d-tx-info">
          <div className="d-tx-name">{t.description||"—"}<span className="d-tx-tag" style={{color:cm(t.category).accent,borderColor:cm(t.category).accent+"44"}}>{t.category}</span></div>
          <div className="d-tx-date">{t.date}</div>
        </div>
        <div className="d-tx-amt">৳{t.amount.toLocaleString()}</div>
        <button className="d-tx-edit" title="Edit" onClick={()=>setEditTx(t)}>✎</button>
        <button className="d-tx-del" title="Delete" onClick={async()=>{
          if(!window.confirm("Delete this transaction?"))return;
          try{await deleteTransaction(t.id,dashMonth);show("Transaction deleted");}
          catch{show("Delete failed","err");}
        }}>{TRASH}</button>
      </div>
    );
  }

  function BRow({b}){
    const s=bStatus(b);
    return (
      <div className="d-brow">
        <div className="d-bmeta">
          <span className="d-bcat">{cm(b.category).icon} {b.category}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className="d-bpct" style={{color:bColor(s)}}>{s.pct.toFixed(0)}%</span>
            <button className="d-tx-edit" title="Edit budget" onClick={()=>setEditBudget(b)}>✎</button>
            <button className="d-tx-del" title="Delete" onClick={async()=>{
              if(!window.confirm("Delete this budget?"))return;
              try{await deleteBudget(b.id,dashMonth);show("Budget deleted");}
              catch{show("Delete failed","err");}
            }}>{TRASH}</button>
          </div>
        </div>
        <div className="d-btrack"><div className="d-bfill" style={{width:`${s.pct}%`,background:bColor(s)}}></div></div>
        <div className="d-bsub"><span className="d-bsubt">৳{s.spent.toLocaleString()} spent</span><span className="d-bsubt">৳{b.monthly_limit.toLocaleString()} limit</span></div>
        {s.isOver&&<span className="chip-over">⚠ Over Budget</span>}
        {!s.isOver&&s.isNear&&<span className="chip-warn">⚡ Near Limit</span>}
      </div>
    );
  }

  function SRow({g}){
    const pct=Math.min((g.saved/g.target)*100,100);
    return (
      <div className="d-srow">
        <div className="d-s-ico" style={{background:g.color+"22",border:`1px solid ${g.color}44`}}>{g.icon}</div>
        <div className="d-s-info">
          <div className="d-s-name">{g.name}</div>
          <div className="d-s-track"><div className="d-s-fill" style={{width:`${pct}%`,background:g.color}}></div></div>
          <div className="d-s-meta"><span className="d-s-txt">৳{g.saved.toLocaleString()} saved</span><span className="d-s-txt">৳{g.target.toLocaleString()} goal</span></div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontFamily:"var(--fd)",fontSize:"1.2rem",fontWeight:700,color:g.color}}>{pct.toFixed(0)}%</div>
          <div style={{fontSize:".58rem",color:"var(--white3)",fontFamily:"var(--fm)"}}>৳{(g.target-g.saved).toLocaleString()} left</div>
          <button className="d-tx-del" onClick={()=>setSavings(p=>p.filter(x=>x.id!==g.id))}>{TRASH}</button>
        </div>
      </div>
    );
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  function shiftM(ym,delta){const[y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+delta,1);return toYM(d);}

  const MonthNav = () => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:10,padding:"8px 16px"}}>
      <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} onClick={()=>switchMonth(shiftM(dashMonth,-1))}>‹</button>
      <span style={{flex:1,textAlign:"center",fontFamily:"var(--fd)",fontWeight:700,color:"var(--gold)"}}>{monthLabel(dashMonth)}</span>
      <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}}
        disabled={dashMonth>=TODAY_YM}
        onClick={()=>switchMonth(shiftM(dashMonth,1))}>›</button>
      {dashMonth!==TODAY_YM&&(
        <button className="btn-dash-o" style={{padding:"4px 10px",fontSize:".65rem",color:"var(--green)",borderColor:"var(--green)"}}
          onClick={()=>switchMonth(TODAY_YM)}>Today</button>
      )}
    </div>
  );

  return (
    <div className="app-wrap">
      {/* Toast */}
      {toast&&<div className={`d-toast d-toast-${toast.type}`}>{toast.msg}</div>}

      {/* SIDEBAR */}
      <aside className="sb">
        <div className="sb-brand"><div className="sb-logo">TYE<span>.</span></div><div className="sb-tag">Track Your Expenses</div></div>
        <div className="sb-sec">
          <div className="sb-sec-lbl">Navigation</div>
          {SB_TABS.map(([id,ico,label])=>(
            <div key={id} className={`sb-item${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}>
              <i className="sb-icon">{ico}</i>{label}
            </div>
          ))}
        </div>
        <div className="sb-div"></div>
        <div className="sb-sec">
          <div className="sb-sec-lbl">Quick Actions</div>
          <div className="sb-item" onClick={()=>setModal("expense")}><i className="sb-icon">+</i>Add Expense</div>
          <div className="sb-item" onClick={()=>setModal("budget")}><i className="sb-icon">◎</i>Set Budget</div>
          <div className="sb-item" onClick={()=>setModal("goal")}><i className="sb-icon">🎯</i>Add Goal</div>
          <div className="sb-item" onClick={()=>setModal("report")}><i className="sb-icon">📊</i>Monthly Report</div>
        </div>
        <div className="sb-foot">
          <div className="sb-user">
            {user.picture?<img src={user.picture} className="sb-avatar-img" alt="avatar"/>:<div className="sb-avatar">{user.name?.charAt(0).toUpperCase()}</div>}
            <div style={{minWidth:0}}><div className="sb-uname">{user.name}</div><div className="sb-email">{user.email}</div></div>
            <button className="sb-exit" onClick={onLogout}>LOGOUT</button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div><div className="tb-date">{now.toLocaleDateString("en-US",{weekday:"long",month:"long",year:"numeric"})}</div><div className="tb-title">Welcome back, <em>{user.name?.split(" ")[0]}</em></div></div>
          <div className="tb-right"><button className="btn-dash-o" onClick={()=>setModal("budget")}>Set Budget</button><button className="btn-dash-p" onClick={()=>setModal("expense")}>+ Add Expense</button></div>
        </div>
        <div className="d-tabs">
          {TABS.map(([id,label])=><div key={id} className={`d-tab${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}>{label}</div>)}
        </div>
        <div className="d-content">
          <div className="d-grule"></div>

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          {activeTab==="dashboard" && <>
            <MonthNav/>
            {dashMonth!==TODAY_YM&&(
              <div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:".78rem",color:"#c084fc",textAlign:"center"}}>
                📅 Viewing <strong>{monthLabel(dashMonth)}</strong>
              </div>
            )}
            {overB.length>0&&<div className="d-alert"><span>⚠️</span><span className="d-alert-txt">{overB.map(b=>cm(b.category).icon+" "+b.category).join(", ")} — budget limit এ পৌঁছে গেছ!</span></div>}
            <div className="d-stats">
              {[["Total Spent",`৳${total.toLocaleString()}`,diff?<span className={diff>0?"dn":"up"}>{parseFloat(diff)>0?"↑":"↓"}{Math.abs(diff)}% last month</span>:"This month","var(--gold)","gold"],
                ["Transactions",thisTxs.length,"This month","#7c6af7",""],
                ["Avg / Expense",`৳${avg}`,"Per transaction","#2dd4bf",""],
                ["Active Budgets",budgets.length,overB.length>0?<span style={{color:"var(--red)"}}>⚠ {overB.length} alert</span>:"All clear ✓","#ff6b6b",""]
              ].map(([lbl,val,sub,ac,cls])=>(
                <div key={lbl} className="d-stat" style={{"--ac":ac}}>
                  <div className="d-stat-lbl">{lbl}</div>
                  <div className={`d-stat-val${cls?" "+cls:""}`}>{val}</div>
                  <span className="d-stat-sub">{sub}</span>
                </div>
              ))}
            </div>
            {pieData.length>0 ? (
              <div className="d-charts-row">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Category Share</span></div><div className="d-pb">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                      {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie><Tooltip content={<CustomTooltip/>}/><Legend formatter={v=><span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{cm(v).icon} {v}</span>}/></PieChart>
                  </ResponsiveContainer>
                </div></div>
                <div className="d-panel"><div className="d-ph"><span className="d-pt">By Category</span></div><div className="d-pb">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}}/><YAxis tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="value" radius={[4,4,0,0]}>{barData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar></BarChart>
                  </ResponsiveContainer>
                </div></div>
              </div>
            ) : (
              <div className="d-panel" style={{marginBottom:14}}><EmptyState icon="📊" title="Charts will appear here" sub="Add expenses to see category breakdown and spending charts."/></div>
            )}
            <div className="d-mgrid">
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Recent Transactions</span><span className="d-pbadge">{thisTxs.length} this month</span></div>
                  {thisTxs.length===0?<EmptyState icon="📋" title="No transactions yet" sub="Add your first expense to see it here." action={()=>setModal("expense")} actionLabel="+ Add Expense"/>:thisTxs.slice(0,6).map(t=><TxRow key={t.id} t={t}/>)}
                </div>
                {savings.length>0&&<div className="d-panel"><div className="d-ph"><span className="d-pt">Savings Goals</span></div>{savings.map(g=><SRow key={g.id} g={g}/>)}</div>}
              </div>
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Budget Status — {monthLabel(dashMonth)}</span></div><div className="d-pb">
                  {budgets.length===0?<EmptyState icon="◎" title="No budgets set" sub="Set a budget to track spending limits."/>:budgets.map(b=><BRow key={b.id} b={b}/>)}
                </div></div>
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Quick Add</span></div><div className="d-pb"><QuickAdd cats={cats} dashMonth={dashMonth} today={today} addTransaction={addTransaction} fetchSummary={fetchSummary} fetchBudgets={fetchBudgets} show={show}/></div></div>
              </div>
            </div>
          </>}

          {/* ── TRANSACTIONS TAB ──────────────────────────────────────────── */}
          {activeTab==="transactions" && <>
            <div className="d-sec-title">≡ All Transactions</div>
            <div className="d-panel"><div className="d-ph"><span className="d-pt">History</span><span className="d-pbadge">{transactions.length} total</span></div>
              {transactions.length===0?<EmptyState icon="📋" title="No transactions yet" sub="Add your first expense to get started." action={()=>setModal("expense")} actionLabel="+ Add First Expense"/>:transactions.map(t=><TxRow key={t.id} t={t}/>)}
            </div>
          </>}

          {/* ── BUDGETS TAB ───────────────────────────────────────────────── */}
          {activeTab==="budgets" && <>
            <div className="d-sec-title">◎ Budget Management</div>
            <MonthNav/>
            <div className="d-mgrid">
              <div className="d-gcol"><div className="d-panel"><div className="d-ph"><span className="d-pt">All Budgets</span><span className="d-pbadge">{budgets.length}</span></div><div className="d-pb">
                {budgets.length===0?<EmptyState icon="◎" title="No budgets yet" sub="Set a budget to start tracking."/>:budgets.map(b=><BRow key={b.id} b={b}/>)}
              </div></div></div>
              <div className="d-gcol"><BudgetForm cats={cats} dashMonth={dashMonth} onSave={async b=>{
                try{await createBudget({...b,month:dashMonth});show(`Budget saved for ${monthLabel(dashMonth)}!`);}
                catch(e){show(e.response?.data?.detail||"Failed to save budget","err");}
              }}/></div>
            </div>
          </>}

          {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
          {activeTab==="analytics" && <>
            <div className="d-sec-title">◆ Analytics</div>
            {monthly.length>0 ? (
              <div className="d-panel" style={{marginBottom:14}}><div className="d-ph"><span className="d-pt">6-Month Trend</span></div><div className="d-pb">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="month" tick={{fontSize:11,fill:"rgba(255,255,255,.4)"}}/><YAxis tick={{fontSize:11,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="amount" stroke="#e8b84b" strokeWidth={2.5} dot={{fill:"#e8b84b",r:5}} activeDot={{r:7}}/></LineChart>
                </ResponsiveContainer>
              </div></div>
            ) : <div className="d-panel" style={{marginBottom:14}}><EmptyState icon="📈" title="No data yet" sub="Add expenses to see monthly trends."/></div>}
            <div className="d-panel"><div className="d-ph"><span className="d-pt">Monthly Summary</span>
              {hiddenMonths.length>0&&<button className="btn-dash-o" style={{fontSize:".6rem",padding:"3px 10px"}} onClick={()=>setHiddenMonths([])}>↺ Restore {hiddenMonths.length}</button>}
            </div>
              {monthly.length===0?<div style={{padding:"20px",textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:".72rem"}}>No data yet</div>:
                (()=>{const maxM=Math.max(...monthly.map(m=>m.amount));return monthly.map((m,i)=>{const prev=monthly[i-1];const d=prev?((m.amount-prev.amount)/prev.amount*100).toFixed(0):null;return(
                  <div key={m.key} className="d-msrow"><div className="d-ms-month">{m.month}</div><div className="d-ms-bar-wrap"><div className="d-ms-bar-bg"><div className="d-ms-bar-fill" style={{width:`${(m.amount/maxM)*100}%`,background:i===monthly.length-1?"#e8b84b":"rgba(232,184,75,.3)"}}></div></div></div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}><div><div className="d-ms-amt">৳{m.amount.toLocaleString()}</div>{d&&<div style={{fontSize:".58rem",color:parseFloat(d)>0?"var(--red)":"var(--green)",textAlign:"right",fontFamily:"var(--fm)"}}>{parseFloat(d)>0?`↑${d}%`:`↓${Math.abs(d)}%`}</div>}</div><button className="d-tx-del" onClick={()=>setHiddenMonths(p=>[...p,m.key])}>{TRASH}</button></div>
                  </div>
                );})})()
              }
            </div>
          </>}

          {/* ── SAVINGS TAB ───────────────────────────────────────────────── */}
          {activeTab==="savings" && <>
            <div className="d-sec-title">💰 Savings Goals</div>
            <div className="d-panel"><div className="d-ph"><span className="d-pt">Your Goals</span><button className="btn-dash-p" style={{fontSize:".62rem",padding:"4px 12px"}} onClick={()=>setModal("goal")}>+ New Goal</button></div>
              {savings.length===0?<EmptyState icon="💰" title="No savings goals yet" sub="Create a goal and track your progress." action={()=>setModal("goal")} actionLabel="+ Add First Goal"/>:savings.map(g=><SRow key={g.id} g={g}/>)}
            </div>
          </>}

          {/* ── CATEGORIES TAB ────────────────────────────────────────────── */}
          {activeTab==="categories" && <>
            <div className="d-sec-title">⊞ Categories</div>
            <div className="d-mgrid">
              <div className="d-gcol"><div className="d-panel"><div className="d-ph"><span className="d-pt">All Categories</span><span className="d-pbadge">{cats.length}</span></div><div className="d-pb">
                {cats.map(c=>{const meta=cm(c);const isDef=DEF_CATS.includes(c);return(
                  <div key={c} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                    <div style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".95rem",borderRadius:8,background:meta.accent+"18",border:`1px solid ${meta.accent}33`,flexShrink:0}}>{meta.icon}</div>
                    <div style={{flex:1,fontSize:".8rem",fontWeight:600,color:"var(--white2)"}}>{c}</div>
                    {isDef?<span style={{fontSize:".52rem",padding:"2px 8px",borderRadius:20,background:"var(--gold-dim)",color:"var(--gold)",border:"1px solid var(--border2)",fontWeight:700,textTransform:"uppercase",fontFamily:"var(--fm)"}}>DEFAULT</span>:<button className="d-tx-del" onClick={()=>setCats(p=>p.filter(x=>x!==c))}>{TRASH}</button>}
                  </div>
                );})}
              </div></div></div>
              <div className="d-gcol"><AddCatForm cats={cats} onAdd={c=>setCats(p=>[...p,c])}/></div>
            </div>
          </>}
        </div>
      </div>

      {/* ══ MODALS ══ */}
      {modal && modal!=="report" && (
        <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setModal(null);}}>
          <div className="d-mbox">
            <div className="d-mhead">
              <div className="d-mtitle">{modal==="expense"?"Add Expense":modal==="budget"?"Set Budget":"New Savings Goal"}</div>
              <button className="d-mclose" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="d-mbody">
              {modal==="expense"&&<ExpenseForm cats={cats} dashMonth={dashMonth} today={today} onSave={async tx=>{
                try{await addTransaction(tx);await fetchSummary(dashMonth);await fetchBudgets(dashMonth);setModal(null);show("Transaction added!");}
                catch(e){show(e.response?.data?.detail||"Failed to add","err");}
              }}/>}
              {modal==="budget"&&<BudgetForm cats={cats} dashMonth={dashMonth} onSave={async b=>{
                try{await createBudget({...b,month:dashMonth});setModal(null);show("Budget created!");}
                catch(e){show(e.response?.data?.detail||"Failed to create budget","err");}
              }} isModal/>}
              {modal==="goal"&&<GoalForm count={savings.length} onSave={g=>{setSavings(p=>[...p,g]);setModal(null);show("Goal created!");}}/>}
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY REPORT MODAL */}
      {modal==="report" && (
        <ReportModal userId={user.id} onClose={()=>setModal(null)} fetchMonthlyReport={fetchMonthlyReport} defaultMonth={dashMonth}/>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editTx && (
        <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setEditTx(null);}}>
          <div className="d-mbox">
            <div className="d-mhead">
              <div className="d-mtitle">✎ Edit Transaction</div>
              <button className="d-mclose" onClick={()=>setEditTx(null)}>✕</button>
            </div>
            <div className="d-mbody">
              <EditTxForm
                tx={editTx}
                cats={cats}
                onSave={async fields=>{
                  try{
                    await updateTransaction(editTx.id, fields, dashMonth);
                    await fetchSummary(dashMonth);
                    setEditTx(null);
                    show("Transaction updated!");
                  }catch(e){show(e.response?.data?.detail||"Update failed","err");}
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* EDIT BUDGET MODAL */}
      {editBudget && (
        <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setEditBudget(null);}}>
          <div className="d-mbox">
            <div className="d-mhead">
              <div className="d-mtitle">✎ Edit Budget — {editBudget.category}</div>
              <button className="d-mclose" onClick={()=>setEditBudget(null)}>✕</button>
            </div>
            <div className="d-mbody">
              <EditBudgetForm
                budget={editBudget}
                onSave={async fields=>{
                  try{
                    await updateBudget(editBudget.id, fields, dashMonth);
                    setEditBudget(null);
                    show("Budget updated!");
                  }catch(e){show(e.response?.data?.detail||"Update failed","err");}
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline form components ─────────────────────────────────────────────────────

function QuickAdd({cats, dashMonth, today, addTransaction, fetchSummary, fetchBudgets, show}){
  const [amt,setAmt]=useState("");const [cat,setCat]=useState(cats[0]||"Food");const [desc,setDesc]=useState("");
  const TODAY_YM=toYM(new Date());
  const [date,setDate]=useState(dashMonth===TODAY_YM?today:`${dashMonth}-01`);
  async function submit(){
    if(!amt||parseFloat(amt)<=0||!date)return;
    try{await addTransaction({amount:parseFloat(amt),category:cat,description:desc,date});
      await fetchSummary(dashMonth);await fetchBudgets(dashMonth);
      setAmt("");setDesc("");show("Transaction added!");
    }catch(e){show(e.response?.data?.detail||"Failed","err");}
  }
  return <div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Amount (৳)</label><input className="d-finp" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/></div>
    <div className="d-ff"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={setCat}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What did you spend on?"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date</label><input className="d-finp" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <button className="d-fbtn" onClick={submit}>Record Expense</button>
  </div>;
}

function ExpenseForm({cats, dashMonth, today, onSave}){
  const TODAY_YM=toYM(new Date());
  const [amt,setAmt]=useState("");const [cat,setCat]=useState(cats[0]||"Food");const [desc,setDesc]=useState("");
  const [date,setDate]=useState(dashMonth===TODAY_YM?today:`${dashMonth}-01`);
  function submit(){if(!amt||parseFloat(amt)<=0||!date)return;onSave({category:cat,description:desc,amount:parseFloat(amt),date});}
  return <div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Amount (৳)</label><input className="d-finp" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/></div>
    <div className="d-ff"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={setCat}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What did you spend on?"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date</label><input className="d-finp" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <button className="d-fbtn" onClick={submit}>Record Expense</button>
  </div>;
}

function BudgetForm({cats, onSave, isModal}){
  const [cat,setCat]=useState(cats[0]||"Food");const [limit,setLimit]=useState("");const [alert,setAlert]=useState("80");
  function submit(){if(!limit)return;onSave({category:cat,monthly_limit:parseFloat(limit),alert_threshold:parseInt(alert)||80});setLimit("");}
  const inner=<div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={setCat}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Monthly Limit (৳)</label><input className="d-finp" type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="5000"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Alert at (%)</label><input className="d-finp" type="number" value={alert} onChange={e=>setAlert(e.target.value)} min="1" max="100"/></div>
    <button className="d-fbtn" onClick={submit}>Save Budget</button>
  </div>;
  if(isModal)return inner;
  return <div className="d-panel"><div className="d-ph"><span className="d-pt">Set / Update Budget</span></div><div className="d-pb">{inner}</div></div>;
}

function GoalForm({count, onSave}){
  const GCOLS=["#e8b84b","#7c6af7","#2dd4bf","#ff6b6b","#4ade80","#f97316","#ec4899","#60a5fa"];
  const [name,setName]=useState("");const [target,setTarget]=useState("");const [saved,setSaved]=useState("");const [icon,setIcon]=useState("🎯");
  function submit(){if(!name||!target)return;onSave({id:Date.now(),name,target:parseFloat(target),saved:parseFloat(saved)||0,icon,color:GCOLS[count%GCOLS.length]});setName("");setTarget("");setSaved("");}
  return <div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Goal Name</label><input className="d-finp" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. New Laptop"/></div>
    <div className="d-ff"><label className="d-flbl">Target (৳)</label><input className="d-finp" type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder="0.00"/></div>
    <div className="d-ff"><label className="d-flbl">Already Saved (৳)</label><input className="d-finp" type="number" value={saved} onChange={e=>setSaved(e.target.value)} placeholder="0.00"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Icon (emoji)</label><input className="d-finp" type="text" value={icon} onChange={e=>setIcon(e.target.value)} maxLength={2}/></div>
    <button className="d-fbtn" onClick={submit}>Create Goal</button>
  </div>;
}

function AddCatForm({cats, onAdd}){
  const [val,setVal]=useState("");
  function gi(c){const l=c.toLowerCase();for(const e of ICON_MAP)if(e.keys.some(k=>l.includes(k)))return e.icon;return"📦";}
  function submit(){if(!val.trim()||cats.includes(val.trim()))return;onAdd(val.trim());setVal("");}
  return <div className="d-panel"><div className="d-ph"><span className="d-pt">Add New</span></div><div className="d-pb"><div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Category Name</label><input className="d-finp" type="text" value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. Healthcare, Gym..."/></div>
    {val.trim()&&<div className="d-ff d-s2"><div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--gold-dim)",border:"1px solid var(--border2)",borderRadius:8}}><span style={{fontSize:"1.2rem"}}>{gi(val)}</span><span style={{fontSize:".72rem",color:"var(--gold)"}}>Auto icon: {gi(val)}</span></div></div>}
    <button className="d-fbtn" onClick={submit}>Add Category</button>
  </div></div></div>;
}

// ── Monthly Report Modal ───────────────────────────────────────────────────────
function ReportModal({userId, onClose, fetchMonthlyReport, defaultMonth}){
  const [reportMonth, setReportMonth] = useState(defaultMonth || toYM(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const TODAY_YM = toYM(new Date());

  const load = useCallback(async (m) => {
    setLoading(true); setReport(null);
    try { const r = await fetchMonthlyReport(m); setReport(r); }
    catch { setReport(null); }
    finally { setLoading(false); }
  }, [fetchMonthlyReport]);

  useState(()=>{ load(reportMonth); }, []); // eslint-disable-line
  // Run on mount:
  useMountEffect(()=>load(reportMonth));

  function shiftM(ym,delta){const[y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+delta,1);return toYM(d);}
  function changeMonth(m){setReportMonth(m);load(m);}

  const months24 = getLast24Months();
  const COLORS2 = ["#e8b84b","#7c6af7","#2dd4bf","#ff6b6b","#4ade80","#f97316","#ec4899","#60a5fa"];

  return (
    <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))onClose();}}>
      <div className="d-mbox" style={{maxWidth:680}}>
        <div className="d-mhead"><div className="d-mtitle">📊 Monthly Report</div><button className="d-mclose" onClick={onClose}>✕</button></div>
        <div className="d-report-nav">
          <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} onClick={()=>changeMonth(shiftM(reportMonth,-1))}>‹</button>
          <select value={reportMonth} onChange={e=>changeMonth(e.target.value)}>
            {months24.map(m=><option key={m.value} value={m.value}>{m.display}</option>)}
          </select>
          <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} disabled={reportMonth>=TODAY_YM} onClick={()=>changeMonth(shiftM(reportMonth,1))}>›</button>
        </div>
        <div style={{padding:"20px 24px",maxHeight:"65vh",overflowY:"auto"}}>
          {loading&&<p style={{textAlign:"center",color:"var(--white3)",padding:40}}>Loading {monthLabel(reportMonth)}…</p>}
          {!loading&&report&&<>
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:12,padding:"18px 20px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:".65rem",color:"var(--white3)",fontFamily:"var(--fm)",marginBottom:6}}>TOTAL SPENT — {monthLabel(reportMonth).toUpperCase()}</div>
              <div style={{fontFamily:"var(--fd)",fontSize:"2rem",fontWeight:900,color:"var(--gold)"}}>৳{report.total_spent?.toFixed(2)||"0.00"}</div>
            </div>
            {Object.keys(report.category_breakdown||{}).length>0 ? <>
              <div style={{marginBottom:12,fontSize:".78rem",fontWeight:700,color:"var(--violet)"}}>Spending by Category</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(report.category_breakdown).map(([name,value])=>({name,value}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}}/>
                  <YAxis tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v}`}/>
                  <Tooltip formatter={v=>[`৳${Number(v).toFixed(2)}`,'Spent']} contentStyle={{background:"#1e1e2e",border:"1px solid #333"}}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>{Object.keys(report.category_breakdown).map((_,i)=><Cell key={i} fill={COLORS2[i%COLORS2.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <table style={{width:"100%",borderCollapse:"collapse",marginTop:20,fontSize:".78rem"}}>
                <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                  <th style={{textAlign:"left",padding:"6px 8px",color:"var(--white3)",fontFamily:"var(--fm)",fontSize:".6rem"}}>CATEGORY</th>
                  <th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontFamily:"var(--fm)",fontSize:".6rem"}}>SPENT</th>
                  {report.budget_comparison&&<><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontFamily:"var(--fm)",fontSize:".6rem"}}>BUDGET</th><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontFamily:"var(--fm)",fontSize:".6rem"}}>USED</th><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontFamily:"var(--fm)",fontSize:".6rem"}}>STATUS</th></>}
                </tr></thead>
                <tbody>{Object.entries(report.category_breakdown).map(([cat,amt])=>{
                  const b=report.budget_comparison?.[cat];
                  return <tr key={cat} style={{borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"8px"}}><span style={{background:cm(cat).accent+"22",border:`1px solid ${cm(cat).accent}44`,color:cm(cat).accent,padding:"2px 8px",borderRadius:20,fontSize:".68rem",fontFamily:"var(--fm)"}}>{cm(cat).icon} {cat}</span></td>
                    <td style={{textAlign:"right",padding:"8px",fontFamily:"var(--fd)",color:"var(--gold)"}}>৳{Number(amt).toFixed(2)}</td>
                    {report.budget_comparison&&b&&<>
                      <td style={{textAlign:"right",padding:"8px",color:"var(--white3)"}}>৳{Number(b.budget).toFixed(2)}</td>
                      <td style={{textAlign:"right",padding:"8px",fontWeight:700,color:b.is_over_budget?"#ff6b6b":"#4ade80"}}>{Number(b.percentage_used).toFixed(1)}%</td>
                      <td style={{textAlign:"right",padding:"8px"}}>{b.is_over_budget?<span style={{color:"#ff6b6b",fontSize:".65rem"}}>⚠ Over ৳{(amt-b.budget).toFixed(0)}</span>:<span style={{color:"#4ade80"}}>✓</span>}</td>
                    </>}
                    {report.budget_comparison&&!b&&<td colSpan={3} style={{textAlign:"right",padding:"8px",color:"#555",fontStyle:"italic",fontSize:".68rem"}}>No budget</td>}
                  </tr>;
                })}</tbody>
              </table>
              {report.budget_comparison&&Object.values(report.budget_comparison).some(b=>b.is_over_budget)&&(
                <div style={{marginTop:16,background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.25)",borderRadius:8,padding:14}}>
                  <div style={{color:"#ff6b6b",fontWeight:700,fontSize:".8rem",marginBottom:8}}>⚠️ Over Budget Categories</div>
                  {Object.entries(report.budget_comparison).filter(([,b])=>b.is_over_budget).map(([cat,b])=>(
                    <div key={cat} style={{fontSize:".75rem",marginBottom:4}}>
                      <strong>{cat}</strong>: overspent ৳{(b.spent-b.budget).toFixed(2)} <span style={{color:"#ff6b6b"}}>({b.percentage_used.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </> : <p style={{textAlign:"center",color:"var(--white3)",padding:30}}>No transactions for {monthLabel(reportMonth)}.</p>}
          </>}
        </div>
      </div>
    </div>
  );
}

// Helper: run callback only once on mount
function useMountEffect(fn){
  const ran=useState(false);
  if(!ran[0]){ran[1](true);fn();}
}

// ── CategorySelect — dropdown with inline "＋ New" option ────────────────────
// Lets users add a brand-new category on-the-go without leaving the form.
function CategorySelect({ cats, value, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  function handleChange(e) {
    if (e.target.value === "__add_new__") { setAdding(true); }
    else onChange(e.target.value);
  }

  function confirmNew() {
    const trimmed = newCat.trim();
    if (!trimmed) { setAdding(false); return; }
    // Add to cats list and select it immediately
    if (!cats.includes(trimmed)) cats.push(trimmed); // mutate-in-place so sibling forms see it too
    onChange(trimmed);
    setAdding(false);
    setNewCat("");
  }

  if (adding) {
    return (
      <div style={{display:"flex",gap:6}}>
        <input
          className="d-finp"
          autoFocus
          value={newCat}
          onChange={e=>setNewCat(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")confirmNew();if(e.key==="Escape"){setAdding(false);setNewCat("");}}}
          placeholder="New category name…"
          style={{flex:1}}
        />
        <button className="d-tx-edit" style={{padding:"0 10px",fontSize:".8rem",borderRadius:6}} onClick={confirmNew}>✓</button>
        <button className="d-tx-del" style={{padding:"0 8px"}} onClick={()=>{setAdding(false);setNewCat("");}}>✕</button>
      </div>
    );
  }

  return (
    <select className="d-finp" value={value} onChange={handleChange}>
      {cats.map(c => <option key={c} value={c}>{c}</option>)}
      <option disabled>──────────</option>
      <option value="__add_new__">＋ Add new category…</option>
    </select>
  );
}

// ── EditTxForm — pre-filled edit form for a transaction ─────────────────────
function EditTxForm({ tx, cats, onSave }) {
  const [amt,  setAmt]  = useState(String(tx.amount));
  const [cat,  setCat]  = useState(tx.category);
  const [desc, setDesc] = useState(tx.description || "");
  const [date, setDate] = useState(tx.date);

  function submit() {
    if (!amt || parseFloat(amt) <= 0 || !date) return;
    onSave({ amount: parseFloat(amt), category: cat, description: desc, date });
  }

  return (
    <div className="d-fgrid">
      <div className="d-ff"><label className="d-flbl">Amount (৳)</label>
        <input className="d-finp" type="number" value={amt} onChange={e=>setAmt(e.target.value)}/>
      </div>
      <div className="d-ff"><label className="d-flbl">Category</label>
        <CategorySelect cats={cats} value={cat} onChange={setCat}/>
      </div>
      <div className="d-ff d-s2"><label className="d-flbl">Description</label>
        <input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description"/>
      </div>
      <div className="d-ff d-s2"><label className="d-flbl">Date</label>
        <input className="d-finp" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </div>
      <button className="d-fbtn" onClick={submit}>Save Changes</button>
    </div>
  );
}

// ── EditBudgetForm — pre-filled edit form for a budget ──────────────────────
function EditBudgetForm({ budget, onSave }) {
  const [limit, setLimit] = useState(String(budget.monthly_limit));
  const [alert, setAlert] = useState(String(budget.alert_threshold ?? 80));

  function submit() {
    if (!limit) return;
    onSave({ monthly_limit: parseFloat(limit), alert_threshold: parseInt(alert) || 80 });
  }

  return (
    <div className="d-fgrid">
      <div className="d-ff d-s2">
        <label className="d-flbl">Category</label>
        <div style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:8,fontSize:".85rem",color:"var(--gold)",fontWeight:600}}>
          {budget.category}
        </div>
      </div>
      <div className="d-ff d-s2"><label className="d-flbl">Monthly Limit (৳)</label>
        <input className="d-finp" type="number" value={limit} onChange={e=>setLimit(e.target.value)}/>
      </div>
      <div className="d-ff d-s2"><label className="d-flbl">Alert at (%)</label>
        <input className="d-finp" type="number" value={alert} onChange={e=>setAlert(e.target.value)} min="1" max="100"/>
      </div>
      <button className="d-fbtn" onClick={submit}>Save Changes</button>
    </div>
  );
}
