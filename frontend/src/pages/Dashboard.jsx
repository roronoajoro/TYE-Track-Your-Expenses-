import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Cell as RCell
} from "recharts";
import { useApi } from "../hooks/useApi";
import "./Dashboard.css";

// ── Constants ──────────────────────────────────────────────────────────────────
const COLORS = ["#e8b84b","#7c6af7","#2dd4bf","#ff6b6b","#4ade80","#f97316","#ec4899","#60a5fa"];
const CAT_META = {
  Food:{icon:"🍜",accent:"#f97316"},Transport:{icon:"🚌",accent:"#3b82f6"},
  Shopping:{icon:"🛍️",accent:"#a855f7"},Utilities:{icon:"⚡",accent:"#ef4444"},
  Entertainment:{icon:"🎬",accent:"#06b6d4"},Rent:{icon:"🏠",accent:"#eab308"},
  Goal:{icon:"🎯",accent:"#e8b84b"},"Loan Repayment":{icon:"💳",accent:"#ff6b6b"},Other:{icon:"📦",accent:"#6b7280"}
};
const ICON_MAP=[
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
  {keys:["loan","debt","borrow","repay"],icon:"💳"},
  {keys:["goal","savings","saving","target"],icon:"🎯"},
];
const INCOME_SOURCES=["Salary","Gift","Donation","Freelance","Business","Other"];
const DEF_CATS=["Food","Transport","Rent","Utilities","Shopping","Entertainment"];
const GOAL_COLORS=["#e8b84b","#7c6af7","#2dd4bf","#ff6b6b","#4ade80","#f97316","#ec4899","#60a5fa"];
const PERIOD_MONTHS={"3M":3,"6M":6,"9M":9,"1Y":12,"All":9999};

function getIcon(cat){const l=cat.toLowerCase();for(const e of ICON_MAP)if(e.keys.some(k=>l.includes(k)))return e.icon;return"📦";}
function cm(cat){return CAT_META[cat]||{icon:getIcon(cat),accent:"#6b7280"};}
function toYM(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function shiftM(ym,delta){const[y,m]=ym.split("-").map(Number);return toYM(new Date(y,m-1+delta,1));}
function getLast24Months(){
  const months=[];const today=new Date();
  for(let i=0;i<24;i++){const d=new Date(today.getFullYear(),today.getMonth()-i,1);months.push({value:toYM(d),display:d.toLocaleDateString("en-US",{year:"numeric",month:"long"})});}
  return months;
}
function monthLabel(ym){
  const f=getLast24Months().find(m=>m.value===ym);if(f)return f.display;
  const[y,m]=ym.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("en-US",{year:"numeric",month:"long"});
}

const TRASH=(
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

function SrvErr({msg}){
  if(!msg)return null;
  return(
    <div className="d-ferr d-s2" style={{background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.3)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:"1rem"}}>🚫</span><span>{msg}</span>
    </div>
  );
}

function useToast(){
  const[toast,setToast]=useState(null);
  const show=useCallback((msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);},[]);
  return{toast,show};
}

const CustomTooltip=({active,payload,label})=>{
  if(active&&payload?.length)return(
    <div style={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,.8)"}}>
      <div style={{marginBottom:4,color:"rgba(255,255,255,.5)"}}>{label}</div>
      <div style={{fontWeight:700,color:"#e8b84b"}}>৳{payload[0].value?.toLocaleString()}</div>
    </div>
  );
  return null;
};

function EarningsSpendingChart({incomeSummary,expenseBreakdown}){
  const[hovered,setHovered]=useState(null);
  const{total_income=0,source_breakdown={},savings=0,carried_forward=0}=incomeSummary;
  // merge carried_forward into the source breakdown so it appears in the inner ring
  const effectiveSrc=carried_forward>0?{"Carried In":carried_forward,...source_breakdown}:source_breakdown;
  const totalSpent=Object.values(expenseBreakdown).reduce((s,v)=>s+v,0);
  const outerData=[{name:"Earnings",value:total_income,fill:"#2dd4bf"},{name:"Spending",value:totalSpent,fill:"#ff6b6b"}];
  const innerData=hovered===0?Object.entries(effectiveSrc).map(([n,v],i)=>({name:n,value:v,fill:COLORS[i%COLORS.length]}))
    :hovered===1?Object.entries(expenseBreakdown).map(([n,v],i)=>({name:n,value:v,fill:COLORS[i%COLORS.length]})):[];
  const sav=Math.max(savings,0);const savPct=total_income>0?((sav/total_income)*100).toFixed(1):0;
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={outerData} dataKey="value" cx="50%" cy="50%" outerRadius={98} innerRadius={66}
              onMouseEnter={(_,i)=>setHovered(i)} onMouseLeave={()=>setHovered(null)} strokeWidth={0}>
              {outerData.map((e,i)=><Cell key={i} fill={e.fill} opacity={hovered===null||hovered===i?1:0.3}/>)}
            </Pie>
            {innerData.length>0&&(<Pie data={innerData} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={28} strokeWidth={0}>{innerData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Pie>)}
            <Tooltip formatter={v=>[`৳${Number(v).toLocaleString()}`]} contentStyle={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,fontSize:11}}/>
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-hint">{hovered===0?"Income sources (inner ring)":hovered===1?"Expense categories (inner ring)":"Hover slices to see breakdown"}</div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:8}}>
          {outerData.map(d=>(<div key={d.name} style={{display:"flex",alignItems:"center",gap:6,fontSize:".68rem",color:"var(--white3)"}}><div style={{width:9,height:9,borderRadius:"50%",background:d.fill}}/>{d.name} — ৳{d.value.toLocaleString()}</div>))}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.2)",borderRadius:12,padding:"18px 16px",textAlign:"center"}}>
          <div style={{fontSize:".58rem",color:"var(--white3)",marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}}>Savings This Month</div>
          <div style={{fontWeight:800,fontSize:"1.6rem",color:"var(--green)"}}>৳{sav.toLocaleString()}</div>
          <div style={{fontSize:".62rem",color:"var(--white3)",marginTop:4}}>{savPct}% of income saved</div>
          {savings<0&&<div style={{fontSize:".62rem",color:"var(--red)",marginTop:4}}>⚠ Spending exceeds income!</div>}
        </div>
        {["Earnings","Spending","Savings"].map((lbl,i)=>{
          const vals=[total_income,totalSpent,sav];const colors=["#2dd4bf","#ff6b6b","#4ade80"];
          const pct=total_income>0?Math.min((vals[i]/total_income)*100,100):0;
          return(<div key={lbl}><div style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:"var(--white3)",marginBottom:4}}><span>{lbl}</span><span style={{color:colors[i]}}>৳{vals[i].toLocaleString()}</span></div><div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",background:colors[i],borderRadius:3,width:`${pct}%`,transition:"width .5s"}}/></div></div>);
        })}
      </div>
    </div>
  );
}

function GlassCalendar({transactions,month}){
  const[hoveredDay,setHoveredDay]=useState(null);
  const daySpending={};
  transactions.forEach(t=>{if(t.date&&t.date.startsWith(month)){const d=t.date.slice(8,10);daySpending[d]=(daySpending[d]||0)+t.amount;}});
  const maxSpending=Math.max(...Object.values(daySpending),1);
  const[year,monthNum]=month.split("-").map(Number);
  const firstDay=new Date(year,monthNum-1,1).getDay();const daysInMonth=new Date(year,monthNum,0).getDate();
  const todayStr=toYM(new Date())===month?new Date().getDate():null;
  const cells=[];for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${month}-${String(d).padStart(2,"0")}`;const dayKey=String(d).padStart(2,"0");
    const spent=daySpending[dayKey]||0;const intensity=spent/maxSpending;
    cells.push({day:d,dateStr,spent,intensity,txList:transactions.filter(t=>t.date===dateStr)});
  }
  return(
    <div className="glass-cal">
      <div className="glass-cal-month-lbl"><span>📅 {monthLabel(month)}</span><span style={{fontSize:".62rem",color:"var(--gold)"}}>Hover days to see transactions</span></div>
      <div className="glass-cal-dow-row">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="glass-cal-dow">{d}</div>)}</div>
      <div className="glass-cal-grid">
        {cells.map((cell,i)=>{
          if(!cell)return<div key={`e${i}`} className="glass-cal-cell empty"/>;
          const alpha=cell.intensity>0?0.12+cell.intensity*0.65:0;const isHov=hoveredDay===cell.day;
          return(<div key={cell.day} className={`glass-cal-cell${cell.spent>0?" has-tx":""}${isHov?" hovered":""}${cell.day===todayStr?" is-today":""}`}
            style={{"--heat":`rgba(232,184,75,${alpha})`}} onMouseEnter={()=>cell.spent>0&&setHoveredDay(cell.day)} onMouseLeave={()=>setHoveredDay(null)}>
            <div className="glass-cal-num">{cell.day}</div>
            {cell.spent>0&&<div className="glass-cal-amt">৳{cell.spent>=1000?`${(cell.spent/1000).toFixed(1)}k`:cell.spent.toFixed(0)}</div>}
            {isHov&&cell.txList.length>0&&(<div className="glass-cal-popup">{cell.txList.slice(0,5).map(t=>(<div key={t.id} className="glass-cal-tx"><span style={{fontSize:".75rem"}}>{cm(t.category).icon}</span><span className="gcal-tx-name">{t.description||t.category}</span><span className="gcal-tx-amt">৳{t.amount.toLocaleString()}</span></div>))}{cell.txList.length>5&&<div className="gcal-tx-more">+{cell.txList.length-5} more</div>}</div>)}
          </div>);
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SAVINGS TREND CHART — custom bar showing positive green / negative red
// ══════════════════════════════════════════════════════════════════════════════
function SavingsTrendBar(props){
  const{x,y,width,height,value}=props;
  const fill=value>=0?"#4ade80":"#ff6b6b";
  const barY=value>=0?y:y+height;const barH=Math.abs(height);
  return<rect x={x} y={barY} width={width} height={barH} fill={fill} rx={3}/>;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({user,onLogout}){
  const[activeTab,setActiveTab]=useState("dashboard");
  const[modal,setModal]=useState(null);
  const[hiddenMonths,setHiddenMonths]=useState([]);
  const[dashMonth,setDashMonth]=useState(()=>toYM(new Date()));
  const[txMonth,setTxMonth]=useState(()=>toYM(new Date()));
  const[editTx,setEditTx]=useState(null);
  const[editBudget,setEditBudget]=useState(null);
  const[allocGoal,setAllocGoal]=useState(null);
  const[analyticsPeriod,setAnalyticsPeriod]=useState("6M");
  const[savingsPeriod,setSavingsPeriod]=useState("6M");
  // Loan state
  const[loanRepayTarget,setLoanRepayTarget]=useState(null);
  // 2-step auto-alloc dialog
  const[autoAllocAlert,setAutoAllocAlert]=useState(null); // {months:[],total,step:1|2}
  // 2-step overspend dialog
  const[overspendAlert,setOverspendAlert]=useState(null); // {amount,step:1|2}

  const TODAY_YM=toYM(new Date());
  const now=new Date();
  const{toast,show}=useToast();

  const{
    transactions,budgets,summary,
    incomes,incomeSummary,
    goals,achievedGoals,
    savingsTransfers,totalSavingsPool,
    loans,loanPayments,
    cats,setCats,
    fetchSummary,fetchBudgets,fetchMonthlyReport,fetchIncomeSummary,fetchTotalSavings,
    addTransaction,deleteTransaction,updateTransaction,
    createBudget,deleteBudget,updateBudget,
    addIncome,deleteIncome,
    addGoal,deleteGoal,allocateToGoal,
    createSavingsTransfer,
    addLoan,deleteLoan,addLoanPayment,
    checkUnallocatedSavings,confirmAutoAllocate,
  }=useApi(user.id);

  const switchMonth=useCallback(async(m)=>{
    setDashMonth(m);
    await fetchSummary(m);await fetchBudgets(m);await fetchIncomeSummary(m);
  },[fetchSummary,fetchBudgets,fetchIncomeSummary]);

  // ── Auto-allocate check (once per day) ──────────────────────────────────────
  useEffect(()=>{
    if(!user.id)return;
    const today=new Date().toISOString().slice(0,10);
    const flag=`tgk_autoalloc_${user.id}_${today}`;
    if(sessionStorage.getItem(flag))return;
    sessionStorage.setItem(flag,"1");
    checkUnallocatedSavings().then(data=>{
      if(data?.unhandled_months?.length>0){
        const total=data.unhandled_months.reduce((s,m)=>s+m.unallocated,0);
        setAutoAllocAlert({months:data.unhandled_months,total,step:1});
      }
    });
  },[user.id]); // eslint-disable-line

  // ── Overspend detection (once per month) ────────────────────────────────────
  useEffect(()=>{
    if(dashMonth!==TODAY_YM)return;
    if(!incomeSummary.total_income||incomeSummary.total_income===0)return;
    if(summary.total_spent<=incomeSummary.total_income)return;
    const flag=`tgk_overspend_${user.id}_${dashMonth}`;
    if(sessionStorage.getItem(flag))return;
    const overspend=summary.total_spent-incomeSummary.total_income;
    setOverspendAlert({amount:overspend,step:1});
  },[summary.total_spent,incomeSummary.total_income,dashMonth]); // eslint-disable-line

  // ── Derived data ────────────────────────────────────────────────────────────
  const lastMonth=useMemo(()=>{const d=new Date(now.getFullYear(),now.getMonth()-1,1);return toYM(d);},[]);
  const thisTxs=useMemo(()=>transactions.filter(t=>t.date?.startsWith(dashMonth)),[transactions,dashMonth]);
  const lastTxs=useMemo(()=>transactions.filter(t=>t.date?.startsWith(lastMonth)),[transactions,lastMonth]);
  const txMonthTxs=useMemo(()=>transactions.filter(t=>t.date?.startsWith(txMonth)),[transactions,txMonth]);
  const breakdown=summary.breakdown||{};
  const n=PERIOD_MONTHS[analyticsPeriod]||6;
  const monthly=useMemo(()=>{
    const map={};transactions.forEach(t=>{if(t.date){const k=t.date.slice(0,7);map[k]=(map[k]||0)+t.amount;}});
    const all=Object.entries(map).sort(([a],[b])=>a.localeCompare(b));
    return(n>=9999?all:all.slice(-n)).filter(([k])=>!hiddenMonths.includes(k))
      .map(([k,amount])=>({month:new Date(k+"-02").toLocaleString("en-US",{month:"short",year:"2-digit"}),amount,key:k}));
  },[transactions,hiddenMonths,n]);

  const savingsTrend=useMemo(()=>{
    const incMap={};incomes.forEach(i=>{if(i.date){const k=i.date.slice(0,7);incMap[k]=(incMap[k]||0)+i.amount;}});
    const txMap={};transactions.forEach(t=>{if(t.date){const k=t.date.slice(0,7);txMap[k]=(txMap[k]||0)+t.amount;}});
    const allM=new Set([...Object.keys(incMap),...Object.keys(txMap)]);
    return[...allM].sort().slice(-12).map(k=>({
      month:new Date(k+"-02").toLocaleString("en-US",{month:"short",year:"2-digit"}),
      savings:(incMap[k]||0)-(txMap[k]||0),key:k
    }));
  },[incomes,transactions]);

  const total=summary.total_spent||0;const lastTotal=lastTxs.reduce((s,t)=>s+t.amount,0);
  const diff=lastTotal?((total-lastTotal)/lastTotal*100).toFixed(1):null;
  const thisMonthIncomes=incomes.filter(i=>i.date?.startsWith(dashMonth));
  const totalIncome=thisMonthIncomes.reduce((s,i)=>s+i.amount,0);
  const carriedIn=incomeSummary.carried_forward||0;
  const effectiveIncome=totalIncome+carriedIn;  // total earned incl. carried-in savings
  const activeLoans=loans.filter(l=>!l.is_paid);
  const totalDebt=activeLoans.reduce((s,l)=>s+l.remaining_amount,0);
  function bStatus(b){const spent=breakdown[b.category]||0;const pct=Math.min((spent/b.monthly_limit)*100,100);return{spent,pct,isOver:spent>b.monthly_limit,isNear:pct>=b.alert_threshold};}
  function bColor(s){return s.isOver?"#ff6b6b":s.isNear?"#f97316":"#e8b84b";}
  const overB=budgets.filter(b=>{const s=bStatus(b);return s.isOver||s.isNear;});
  const pieData=Object.entries(breakdown).map(([name,value])=>({name,value}));
  const today=`${TODAY_YM}-${now.getDate().toString().padStart(2,"0")}`;
  const months24=getLast24Months();

  // ── Auto-alloc handlers ────────────────────────────────────────────────────
  async function handleConfirmAutoAlloc(){
    try{
      const result=await confirmAutoAllocate(autoAllocAlert.months.map(m=>m.month));
      setAutoAllocAlert(null);
      await fetchTotalSavings();
      show(`🏦 ৳${autoAllocAlert.total.toLocaleString()} added to your lifetime savings pool!`);
    }catch(e){show(e?.response?.data?.detail||"Auto-allocate failed","err");}
  }
  function handleDismissAutoAlloc(){
    setAutoAllocAlert(null); // dismissed after step 2 confirmation
  }

  // ── Overspend handlers ─────────────────────────────────────────────────────
  function handleAddLoanFromOverspend(){
    sessionStorage.setItem(`tgk_overspend_${user.id}_${dashMonth}`,"1");
    setOverspendAlert(null);
    setModal("loan");
  }
  function handleDismissOverspend(){
    sessionStorage.setItem(`tgk_overspend_${user.id}_${dashMonth}`,"1");
    setOverspendAlert(null);
  }

  // ── Past-month income: after adding income to a closed month, re-check unallocated savings ──
  async function handleIncomeSaved(inc){
    await addIncome(inc);
    await fetchIncomeSummary(inc.date.slice(0,7));
    const incMonth=inc.date.slice(0,7);
    if(incMonth<TODAY_YM){
      // The month has already ended — check if there are now unallocated savings
      const data=await checkUnallocatedSavings();
      if(data?.unhandled_months?.length>0){
        const total=data.unhandled_months.reduce((s,m)=>s+m.unallocated,0);
        setAutoAllocAlert({months:data.unhandled_months,total,step:1});
      }
    }
  }

  const TABS=[
    ["dashboard","▣ Dashboard"],["income","💸 Income"],["transactions","≡ Transactions"],
    ["budgets","◎ Budgets"],["analytics","◆ Analytics"],
    ["goals","🎯 Goals"],["savings","◈ Savings"],["loans","💳 Loans"],["categories","⊞ Categories"]
  ];
  const SB_TABS=[
    ["dashboard","▣","Dashboard"],["income","💸","Income"],["transactions","≡","Transactions"],
    ["budgets","◎","Budgets"],["analytics","◆","Analytics"],
    ["goals","🎯","Goals"],["savings","◈","Savings"],["loans","💳","Loans"],["categories","⊞","Categories"]
  ];

  function EmptyState({icon,title,sub,action,actionLabel}){
    return(<div className="d-empty"><div className="d-empty-ico">{icon}</div><div className="d-empty-title">{title}</div><div className="d-empty-sub">{sub}</div>{action&&<button className="btn-dash-p" onClick={action}>{actionLabel}</button>}</div>);
  }
  function TxRow({t}){
    return(<div className="d-tx">
      <div className="d-tx-ico">{cm(t.category).icon}</div>
      <div className="d-tx-info"><div className="d-tx-name">{t.description||"—"}<span className="d-tx-tag" style={{color:cm(t.category).accent,borderColor:cm(t.category).accent+"44"}}>{t.category}</span>{t.from_savings&&<span className="d-tx-savings">from savings</span>}</div><div className="d-tx-date">{t.date}</div></div>
      <div className="d-tx-amt">৳{t.amount.toLocaleString()}</div>
      <button className="d-tx-edit" onClick={()=>setEditTx(t)}>✎</button>
      <button className="d-tx-del" onClick={async()=>{if(!window.confirm("Delete this transaction?"))return;try{await deleteTransaction(t.id,dashMonth);show("Transaction deleted");}catch{show("Delete failed","err");}}}>{TRASH}</button>
    </div>);
  }
  function IncomeRow({inc}){
    const srcIcon={Salary:"💼",Gift:"🎁",Donation:"🤝",Freelance:"💻",Business:"🏢"}[inc.source]||"💰";
    return(<div className="d-inc-row">
      <div className="d-inc-ico">{srcIcon}</div>
      <div className="d-inc-info"><div className="d-inc-name">{inc.description||inc.source}<span className="d-inc-src">{inc.source}</span></div><div className="d-inc-date">{inc.date}</div></div>
      <div className="d-inc-amt">+৳{inc.amount.toLocaleString()}</div>
      <button className="d-tx-del" onClick={async()=>{if(!window.confirm("Delete this income record?"))return;try{await deleteIncome(inc.id);show("Income deleted");}catch{show("Delete failed","err");}}}>{TRASH}</button>
    </div>);
  }
  function BRow({b}){
    const s=bStatus(b);
    return(<div className="d-brow">
      <div className="d-bmeta"><span className="d-bcat">{cm(b.category).icon} {b.category}</span><div style={{display:"flex",alignItems:"center",gap:8}}><span className="d-bpct" style={{color:bColor(s)}}>{s.pct.toFixed(0)}%</span><button className="d-tx-edit" onClick={()=>setEditBudget(b)}>✎</button><button className="d-tx-del" onClick={async()=>{if(!window.confirm("Delete this budget?"))return;try{await deleteBudget(b.id,dashMonth);show("Budget deleted");}catch{show("Delete failed","err");}}}>{TRASH}</button></div></div>
      <div className="d-btrack"><div className="d-bfill" style={{width:`${s.pct}%`,background:bColor(s)}}/></div>
      <div className="d-bsub"><span className="d-bsubt">৳{s.spent.toLocaleString()} spent</span><span className="d-bsubt">৳{b.monthly_limit.toLocaleString()} limit</span></div>
      {s.isOver&&<span className="chip-over">🚨 Over Budget — Stop Spending</span>}
      {!s.isOver&&s.isNear&&<span className="chip-warn">⚡ Reaching Budget Limit</span>}
    </div>);
  }
  function GoalCard({g}){
    const pct=Math.min((g.current_amount/g.target_amount)*100,100);const remaining=Math.max(g.target_amount-g.current_amount,0);
    return(<div className="d-goal-card">
      <div className="d-goal-ico" style={{background:g.color+"22",border:`1px solid ${g.color}44`}}>{g.icon}</div>
      <div className="d-goal-info">
        <div className="d-goal-name">{g.name}</div>
        <div className="d-goal-track"><div className="d-goal-fill" style={{width:`${pct}%`,background:g.color}}/></div>
        <div className="d-goal-meta"><span>৳{g.current_amount.toLocaleString()} saved</span><span>৳{g.target_amount.toLocaleString()} target</span></div>
        {g.deadline&&<div style={{fontSize:".6rem",color:"var(--white3)",marginTop:3}}>📅 Deadline: {g.deadline}</div>}
        <div className="d-goal-actions">
          <button className="d-tx-edit" style={{fontSize:".65rem",padding:"3px 10px"}} onClick={()=>setAllocGoal(g)}>+ Allocate</button>
          <button className="d-tx-del" onClick={async()=>{if(!window.confirm("Delete this goal?"))return;try{await deleteGoal(g.id);show("Goal deleted");}catch{show("Delete failed","err");}}}>{TRASH}</button>
        </div>
      </div>
      <div className="d-goal-right"><div className="d-goal-pct" style={{color:g.color}}>{pct.toFixed(0)}%</div><div className="d-goal-left">৳{remaining.toLocaleString()} left</div></div>
    </div>);
  }
  function LoanCard({loan}){
    const paid=loan.amount-loan.remaining_amount;const pct=loan.amount>0?Math.min((paid/loan.amount)*100,100):0;
    return(<div className={`d-loan-card${loan.is_paid?" is-paid":""}`}>
      <div className="d-loan-top">
        <div>
          <div className="d-loan-name">{loan.description||"Loan"}</div>
          {loan.lender&&<div className="d-loan-lender-badge">🏦 {loan.lender}</div>}
          <div className="d-loan-date-lbl">📅 {loan.date}</div>
        </div>
        <div className="d-loan-right">
          <div className={`d-loan-status-badge ${loan.is_paid?"paid":"active"}`}>{loan.is_paid?"✓ Paid":"Active"}</div>
          <div className="d-loan-remaining-amt">৳{loan.remaining_amount.toLocaleString()} left</div>
        </div>
      </div>
      <div className="d-loan-track"><div className="d-loan-fill" style={{width:`${pct}%`}}/></div>
      <div className="d-loan-sub"><span>৳{paid.toLocaleString()} paid</span><span>{pct.toFixed(0)}% repaid</span><span>৳{loan.amount.toLocaleString()} original</span></div>
      <div className="d-loan-actions">
        {!loan.is_paid&&<button className="d-loan-repay-btn" onClick={()=>setLoanRepayTarget(loan)}>💳 Repay</button>}
        <button className="d-tx-del" onClick={async()=>{if(!window.confirm("Delete this loan?"))return;try{await deleteLoan(loan.id);show("Loan deleted");}catch{show("Delete failed","err");}}}>{TRASH}</button>
      </div>
    </div>);
  }
  const MonthNav=()=>(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:10,padding:"8px 16px"}}>
      <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} onClick={()=>switchMonth(shiftM(dashMonth,-1))}>‹</button>
      <span style={{flex:1,textAlign:"center",fontFamily:"sans-serif",fontWeight:700,color:"var(--gold)"}}>{monthLabel(dashMonth)}</span>
      <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} disabled={dashMonth>=TODAY_YM} onClick={()=>switchMonth(shiftM(dashMonth,1))}>›</button>
      {dashMonth!==TODAY_YM&&<button className="btn-dash-o" style={{padding:"4px 10px",fontSize:".65rem",color:"var(--green)",borderColor:"var(--green)"}} onClick={()=>switchMonth(TODAY_YM)}>Today</button>}
    </div>
  );

  return(
    <div className="app-wrap">
      {toast&&<div className={`d-toast d-toast-${toast.type}`}>{toast.msg}</div>}

      {/* ── AUTO-ALLOC 2-STEP DIALOG ─────────────────────────────────────────── */}
      {autoAllocAlert&&(
        <div className="d-moverlay">
          <div className="d-confirm-box">
            {autoAllocAlert.step===1?(
              <>
                <div className="d-confirm-head">
                  <div className="d-confirm-icon">💰</div>
                  <div className="d-confirm-title">Unallocated Savings Found!</div>
                  <div className="d-confirm-sub">You have savings from past months that weren&apos;t added to your lifetime pool. Add them now?</div>
                </div>
                <div className="d-confirm-body">
                  {autoAllocAlert.months.map(m=>(
                    <div key={m.month} className="d-confirm-month-row">
                      <span className="d-confirm-month-lbl">📅 {monthLabel(m.month)}</span>
                      <span className="d-confirm-month-amt">+৳{m.unallocated.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="d-confirm-total-row">
                    <span style={{fontSize:".72rem",fontWeight:700,color:"var(--white2)"}}>Total to Add</span>
                    <span style={{fontSize:".82rem",fontWeight:800,color:"var(--green)"}}>+৳{autoAllocAlert.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="d-confirm-actions">
                  <button className="d-confirm-btn-yes" onClick={handleConfirmAutoAlloc}>🏦 Yes, Add to Pool</button>
                  <button className="d-confirm-btn-skip" onClick={()=>setAutoAllocAlert({...autoAllocAlert,step:2})}>Not Now</button>
                </div>
              </>
            ):(
              <>
                <div className="d-confirm-head">
                  <div className="d-confirm-icon">⚠️</div>
                  <div className="d-confirm-title">Are you sure?</div>
                  <div className="d-confirm-sub">Your ৳{autoAllocAlert.total.toLocaleString()} in savings won&apos;t be added to your lifetime pool. This cannot be undone unless you manually transfer later.</div>
                </div>
                <div className="d-confirm-body"/>
                <div className="d-confirm-actions">
                  <button className="d-confirm-btn-danger" onClick={handleDismissAutoAlloc}>Yes, I&apos;m Sure — Skip</button>
                  <button className="d-confirm-btn-back" onClick={()=>setAutoAllocAlert({...autoAllocAlert,step:1})}>← Go Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── OVERSPEND 2-STEP DIALOG ──────────────────────────────────────────── */}
      {overspendAlert&&(
        <div className="d-moverlay">
          <div className="d-confirm-box">
            {overspendAlert.step===1?(
              <>
                <div className="d-confirm-head">
                  <div className="d-confirm-icon">🚨</div>
                  <div className="d-confirm-title">You&apos;ve Overspent This Month!</div>
                  <div className="d-confirm-sub">Your spending exceeds your income by <strong style={{color:"#ff8a8a"}}>৳{overspendAlert.amount.toLocaleString()}</strong>. Would you like to record this as a loan?</div>
                </div>
                <div className="d-confirm-body">
                  <div style={{background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.2)",borderRadius:10,padding:14,fontSize:".75rem",color:"var(--white3)",lineHeight:1.7}}>
                    Recording as a loan helps you track the debt and repay it later from your income or savings pool.
                  </div>
                </div>
                <div className="d-confirm-actions">
                  <button className="d-confirm-btn-yes" onClick={handleAddLoanFromOverspend}>💳 Yes, Add as Loan</button>
                  <button className="d-confirm-btn-skip" onClick={()=>setOverspendAlert({...overspendAlert,step:2})}>No, Skip</button>
                </div>
              </>
            ):(
              <>
                <div className="d-confirm-head">
                  <div className="d-confirm-icon">⚠️</div>
                  <div className="d-confirm-title">Skip Loan Tracking?</div>
                  <div className="d-confirm-sub">Untracked overspending of <strong style={{color:"#ff8a8a"}}>৳{overspendAlert.amount.toLocaleString()}</strong> may make your financial reports inaccurate. Are you sure?</div>
                </div>
                <div className="d-confirm-body"/>
                <div className="d-confirm-actions">
                  <button className="d-confirm-btn-danger" onClick={handleDismissOverspend}>Yes, Skip It</button>
                  <button className="d-confirm-btn-back" onClick={()=>setOverspendAlert({...overspendAlert,step:1})}>← Add as Loan</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="sb">
        <div className="sb-brand"><div className="sb-logo">Taka Gelo Koi<span>.</span></div><div className="sb-tag">Track Your Money</div></div>
        <div className="sb-sec">
          <div className="sb-sec-lbl">Navigation</div>
          {SB_TABS.map(([id,ico,label])=>(<div key={id} className={`sb-item${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}><i className="sb-icon">{ico}</i>{label}</div>))}
        </div>
        <div className="sb-div"/>
        <div className="sb-sec">
          <div className="sb-sec-lbl">Quick Actions</div>
          <div className="sb-item" onClick={()=>setModal("expense")}><i className="sb-icon">+</i>Add Expense</div>
          <div className="sb-item" onClick={()=>setModal("income")}><i className="sb-icon">💸</i>Add Income</div>
          <div className="sb-item" onClick={()=>setModal("budget")}><i className="sb-icon">◎</i>Set Budget</div>
          <div className="sb-item" onClick={()=>setModal("goal")}><i className="sb-icon">🎯</i>Add Goal</div>
          <div className="sb-item" onClick={()=>setModal("loan")}><i className="sb-icon">💳</i>Add Loan</div>
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
          <div className="tb-right">
            <button className="btn-dash-o" onClick={()=>setModal("income")}>💸 Add Income</button>
            <button className="btn-dash-p" onClick={()=>setModal("expense")}>+ Add Expense</button>
          </div>
        </div>
        <div className="d-tabs">{TABS.map(([id,label])=><div key={id} className={`d-tab${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}>{label}</div>)}</div>
        <div className="d-content">
          <div className="d-grule"/>

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
          {activeTab==="dashboard"&&<>
            <MonthNav/>
            {dashMonth!==TODAY_YM&&<div style={{background:"rgba(168,85,247,.08)",border:"1px solid rgba(168,85,247,.25)",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:".78rem",color:"#c084fc",textAlign:"center"}}>📅 Viewing <strong>{monthLabel(dashMonth)}</strong></div>}
            {overB.length>0&&<div className="d-alert"><span>⚠️</span><span className="d-alert-txt">{overB.map(b=>{const s=bStatus(b);return`${cm(b.category).icon} ${b.category} — ${s.isOver?"Over Budget":"Reaching Limit"}`;}).join(" | ")}</span></div>}
            <div className="d-stats">
              {[["Total Earned",`৳${effectiveIncome.toLocaleString()}`,carriedIn>0?`${thisMonthIncomes.length} records + ৳${carriedIn.toLocaleString()} carried in`:`${thisMonthIncomes.length} records`,"var(--teal)",""],
                ["Total Spent",`৳${total.toLocaleString()}`,diff?<span className={parseFloat(diff)>0?"dn":"up"}>{parseFloat(diff)>0?"↑":"↓"}{Math.abs(diff)}% last month</span>:"This month","var(--gold)","gold"],
                ["Transactions",thisTxs.length,"This month","#7c6af7",""],
                ["Active Budgets",budgets.length,overB.length>0?<span style={{color:"var(--red)"}}>⚠ {overB.length} alert{overB.length>1?"s":""}</span>:"All clear ✓","#ff6b6b",""],
              ].map(([lbl,val,sub,ac,cls])=>(
                <div key={lbl} className="d-stat" style={{"--ac":ac}}><div className="d-stat-lbl">{lbl}</div><div className={`d-stat-val${cls?" "+cls:""}`}>{val}</div><span className="d-stat-sub">{sub}</span></div>
              ))}
            </div>
            <div className="d-charts-row">
              <div className="d-panel"><div className="d-ph"><span className="d-pt">Earnings vs Spending</span><span className="d-pbadge">{monthLabel(dashMonth)}</span></div><div className="d-pb">{effectiveIncome===0&&total===0?<EmptyState icon="💸" title="No data yet" sub="Add income and expenses to see this chart."/>:<EarningsSpendingChart incomeSummary={{...incomeSummary,total_income:effectiveIncome,carried_forward:carriedIn,savings:effectiveIncome-total}} expenseBreakdown={breakdown}/>}</div></div>
              <div className="d-panel"><div className="d-ph"><span className="d-pt">Spending by Category</span></div><div className="d-pb">{pieData.length>0?(<ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} innerRadius={50}>{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip content={<CustomTooltip/>}/><Legend formatter={v=><span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{cm(v).icon} {v}</span>}/></PieChart></ResponsiveContainer>):<EmptyState icon="📊" title="No expenses yet" sub="Add expenses to see category chart."/>}</div></div>
            </div>
            {/* ── Loan Overview — below earnings chart ────────────────────────── */}
            {activeLoans.length>0&&(
              <div className="d-panel" style={{marginBottom:14}}>
                <div className="d-ph"><span className="d-pt">💳 Loan Overview</span><span className="d-pbadge">{activeLoans.length} active — ৳{totalDebt.toLocaleString()} outstanding</span></div>
                <div className="d-pb">
                  <ResponsiveContainer width="100%" height={Math.max(activeLoans.length*52,120)}>
                    <BarChart data={activeLoans.map(l=>({name:l.lender||l.description||"Loan",paid:l.amount-l.remaining_amount,remaining:l.remaining_amount}))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                      <XAxis type="number" tick={{fontSize:9,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} width={80}/>
                      <Tooltip formatter={(v,n)=>[`৳${v.toLocaleString()}`,n==="paid"?"Paid":"Remaining"]} contentStyle={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,fontSize:11}}/>
                      <Bar dataKey="paid" stackId="a" fill="#4ade80" name="paid"/>
                      <Bar dataKey="remaining" stackId="a" fill="#ff6b6b" name="remaining" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <div className="d-mgrid">
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Recent Transactions</span><span className="d-pbadge">{thisTxs.length} this month</span></div>{thisTxs.length===0?<EmptyState icon="📋" title="No transactions yet" sub="Add your first expense." action={()=>setModal("expense")} actionLabel="+ Add Expense"/>:thisTxs.slice(0,6).map(t=><TxRow key={t.id} t={t}/>)}</div>
              </div>
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Budget Status</span></div><div className="d-pb">{budgets.length===0?<EmptyState icon="◎" title="No budgets set" sub="Set a budget to track spending limits."/>:budgets.map(b=><BRow key={b.id} b={b}/>)}</div></div>
              </div>
            </div>
          </>}

          {/* ── INCOME TAB ────────────────────────────────────────────────── */}
          {activeTab==="income"&&<>
            <div className="d-sec-title">💸 Income Management</div>
            <MonthNav/>
            <div className="d-stats" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
              {[["Total Earned",`৳${(incomeSummary.total_income||0).toLocaleString()}`,"This month","var(--teal)"],
                ["Savings",`৳${Math.max(incomeSummary.savings||0,0).toLocaleString()}`,"Income − Expenses","var(--green)"],
                ["Carried In",`৳${(incomeSummary.carried_forward||0).toLocaleString()}`,"From prev. months","#7c6af7"],
                ["Net Available",`৳${Math.max(incomeSummary.net_savings||0,0).toLocaleString()}`,"Total available","#e8b84b"],
              ].map(([l,v,s,c])=>(<div key={l} className="d-stat" style={{"--ac":c}}><div className="d-stat-lbl">{l}</div><div className="d-stat-val">{v}</div><span className="d-stat-sub">{s}</span></div>))}
            </div>
            <div className="d-mgrid">
              <div className="d-gcol">
                <div className="d-panel">
                  <div className="d-ph"><span className="d-pt">Income Records — {monthLabel(dashMonth)}</span><span className="d-pbadge">{incomes.filter(i=>i.date?.startsWith(dashMonth)).length} records</span></div>
                  {/* Carried-in virtual row */}
                  {incomeSummary.carried_forward>0&&(
                    <div className="d-inc-row d-inc-row--carried">
                      <div className="d-inc-ico">📅</div>
                      <div className="d-inc-info"><div className="d-inc-name">Carried Forward<span className="d-inc-src d-inc-src--carried">Carried In</span></div><div className="d-inc-date">Savings brought in from previous months</div></div>
                      <div className="d-inc-amt d-inc-amt--carried">+৳{incomeSummary.carried_forward.toLocaleString()}</div>
                    </div>
                  )}
                  {incomes.filter(i=>i.date?.startsWith(dashMonth)).length===0&&!incomeSummary.carried_forward
                    ?<EmptyState icon="💸" title="No income recorded" sub="Add your salary, gifts or donations." action={()=>setModal("income")} actionLabel="+ Add Income"/>
                    :incomes.filter(i=>i.date?.startsWith(dashMonth)).map(inc=><IncomeRow key={inc.id} inc={inc}/>)
                  }
                </div>
                {Object.keys(incomeSummary.source_breakdown||{}).length>0&&(
                  <div className="d-panel">
                    <div className="d-ph"><span className="d-pt">By Source — {monthLabel(dashMonth)}</span></div>
                    <div className="d-pb">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          ...(incomeSummary.carried_forward>0?[{name:"Carried In",value:incomeSummary.carried_forward}]:[]),
                          ...Object.entries(incomeSummary.source_breakdown).map(([name,value])=>({name,value}))
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                          <XAxis dataKey="name" tick={{fontSize:11,fill:"rgba(255,255,255,.4)"}}/>
                          <YAxis tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Bar dataKey="value" radius={[4,4,0,0]}>{[...(incomeSummary.carried_forward>0?[{name:"Carried In"}]:[]),...Object.keys(incomeSummary.source_breakdown)].map((_,i)=><Cell key={i} fill={i===0&&incomeSummary.carried_forward>0?"#7c6af7":COLORS[i%COLORS.length]}/>)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
              <div className="d-gcol"><div className="d-panel"><div className="d-ph"><span className="d-pt">Add Income</span></div><div className="d-pb"><IncomeForm cats={INCOME_SOURCES} dashMonth={dashMonth} today={today} onSave={async inc=>{await handleIncomeSaved(inc);show("Income added!");}}/></div></div></div>
            </div>
          </>}

          {/* ── TRANSACTIONS TAB ──────────────────────────────────────────── */}
          {activeTab==="transactions"&&<>
            <div className="d-sec-title">≡ Transactions</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 16px"}}>
              <span style={{fontSize:".72rem",color:"var(--white3)",fontWeight:600}}>Showing month:</span>
              <select className="d-finp" style={{maxWidth:200,margin:0,padding:"6px 10px"}} value={txMonth} onChange={e=>setTxMonth(e.target.value)}>{months24.map(m=><option key={m.value} value={m.value}>{m.display}</option>)}</select>
              <span className="d-pbadge">{txMonthTxs.length} transactions</span>
              {txMonth!==TODAY_YM&&<button className="btn-dash-o" style={{padding:"4px 10px",fontSize:".65rem"}} onClick={()=>setTxMonth(TODAY_YM)}>Current Month</button>}
            </div>
            <div className="d-tx-cal-layout">
              <div><GlassCalendar transactions={txMonthTxs} month={txMonth}/></div>
              <div className="d-panel" style={{marginBottom:0}}>
                <div className="d-ph"><span className="d-pt">Transactions — {monthLabel(txMonth)}</span><button className="btn-dash-p" style={{fontSize:".62rem",padding:"4px 12px"}} onClick={()=>setModal("expense")}>+ Add</button></div>
                {txMonthTxs.length===0?<EmptyState icon="📋" title="No transactions" sub={`No expenses found for ${monthLabel(txMonth)}.`}/>:txMonthTxs.map(t=><TxRow key={t.id} t={t}/>)}
              </div>
            </div>
          </>}

          {/* ── BUDGETS TAB ───────────────────────────────────────────────── */}
          {activeTab==="budgets"&&<>
            <div className="d-sec-title">◎ Budget Management</div>
            <MonthNav/>
            <div className="d-mgrid">
              <div className="d-gcol"><div className="d-panel"><div className="d-ph"><span className="d-pt">All Budgets</span><span className="d-pbadge">{budgets.length}</span></div><div className="d-pb">{budgets.length===0?<EmptyState icon="◎" title="No budgets yet" sub="Set a budget to start tracking."/>:budgets.map(b=><BRow key={b.id} b={b}/>)}</div></div></div>
              <div className="d-gcol"><BudgetForm cats={cats} dashMonth={dashMonth} onSave={async b=>{await createBudget({...b,month:dashMonth});show(`Budget saved for ${monthLabel(dashMonth)}!`);}}/></div>
            </div>
          </>}

          {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
          {activeTab==="analytics"&&<>
            <div className="d-sec-title">◆ Analytics</div>

            {/* ── Spending Trend ──────────────────────────────────────────────────── */}
            <div className="analytics-toggle-row">
              <span style={{fontSize:".78rem",fontWeight:700,color:"var(--white2)"}}>Spending Trend</span>
              <div className="period-toggle">
                {["3M","6M","9M","1Y","All"].map(p=><button key={p} className={`period-btn${analyticsPeriod===p?" active":""}`} onClick={()=>setAnalyticsPeriod(p)}>{p}</button>)}
              </div>
            </div>
            {monthly.length>0?(
              <div className="d-panel" style={{marginBottom:14}}>
                <div className="d-ph"><span className="d-pt">{analyticsPeriod==="All"?"All-Time":"Last "+analyticsPeriod} Spending Trend</span></div>
                <div className="d-pb">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                      <XAxis dataKey="month" tick={{fontSize:11,fill:"rgba(255,255,255,.4)"}}/>
                      <YAxis tick={{fontSize:11,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Line type="monotone" dataKey="amount" stroke="#e8b84b" strokeWidth={2.5} dot={{fill:"#e8b84b",r:5}} activeDot={{r:7}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ):<div className="d-panel" style={{marginBottom:14}}><EmptyState icon="📈" title="No data yet" sub="Add expenses to see spending trend."/></div>}

            {/* ── Savings Trend with period toggle (line chart) ─────────────────── */}
            <div className="analytics-toggle-row" style={{marginTop:4}}>
              <span style={{fontSize:".78rem",fontWeight:700,color:"var(--white2)"}}>Savings Trend</span>
              <div className="period-toggle">
                {["3M","6M","9M","1Y","All"].map(p=><button key={p} className={`period-btn${savingsPeriod===p?" active":""}`} onClick={()=>setSavingsPeriod(p)}>{p}</button>)}
              </div>
            </div>
            <div className="d-panel" style={{marginBottom:14}}>
              {(()=>{
                const ns=PERIOD_MONTHS[savingsPeriod]||9999;
                const filtered=savingsTrend.slice(-ns);
                const posCount=filtered.filter(m=>m.savings>0).length;
                return(<>
                  <div className="d-ph">
                    <span className="d-pt">{savingsPeriod==="All"?"All-Time":"Last "+savingsPeriod} Savings Trend</span>
                    <span className="d-pbadge" style={{color:"var(--green)"}}>{posCount} positive month{posCount!==1?"s":""}</span>
                  </div>
                  {filtered.length>0?(
                    <div className="d-pb">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={filtered}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                          <XAxis dataKey="month" tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}}/>
                          <YAxis tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v.toLocaleString()}`}/>
                          <Tooltip formatter={v=>[`৳${Number(v).toLocaleString()}`,"Savings"]} contentStyle={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,fontSize:11}}/>
                          <Line type="monotone" dataKey="savings" stroke="#4ade80" strokeWidth={2.5}
                            dot={(p)=><circle key={`sv-${p.index}`} cx={p.cx} cy={p.cy} r={5} fill={p.value>=0?"#4ade80":"#ff6b6b"} stroke="none"/>}
                            activeDot={{r:7,fill:"#4ade80"}}/>
                        </LineChart>
                      </ResponsiveContainer>
                      <div style={{display:"flex",justifyContent:"center",gap:20,fontSize:".65rem",color:"var(--white3)",marginTop:6}}>
                        <span><span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#4ade80",marginRight:5,verticalAlign:"middle"}}/>Positive savings</span>
                        <span><span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#ff6b6b",marginRight:5,verticalAlign:"middle"}}/>Overspent month</span>
                      </div>
                    </div>
                  ):<EmptyState icon="💰" title="No savings data" sub="Add both income and expenses to see savings trend."/>}
                </>);
              })()}
            </div>
          </>}

          {/* ── GOALS TAB ─────────────────────────────────────────────────── */}
          {activeTab==="goals"&&<>
            <div className="d-sec-title">🎯 Financial Goals</div>
            <div className="d-mgrid">
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Active Goals</span><span className="d-pbadge">{goals.length} active</span></div>{goals.length===0?<EmptyState icon="🎯" title="No goals yet" sub="Create a financial goal and track your progress." action={()=>setModal("goal")} actionLabel="+ New Goal"/>:goals.map(g=><GoalCard key={g.id} g={g}/>)}</div>
                {achievedGoals.length>0&&(<div className="d-panel"><div className="d-ph"><span className="d-pt">🏆 Achieved Goals</span><span className="d-pbadge">{achievedGoals.length} completed</span></div><div className="d-achieved-grid">{achievedGoals.map(g=>(<div key={g.id} className="d-achieved-card"><div className="d-achieved-ico">{g.icon}</div><div className="d-achieved-name">{g.name}</div><div className="d-achieved-amt">৳{g.target_amount.toLocaleString()} achieved ✓</div></div>))}</div></div>)}
              </div>
              <div className="d-gcol"><div className="d-panel"><div className="d-ph"><span className="d-pt">Create New Goal</span></div><div className="d-pb"><GoalForm count={goals.length} dashMonth={dashMonth} onSave={async g=>{await addGoal(g);show("Goal created!");}}/></div></div></div>
            </div>
          </>}

          {/* ── SAVINGS TAB ───────────────────────────────────────────────── */}
          {activeTab==="savings"&&<>
            <div className="d-sec-title">◈ Savings Management</div>
            <MonthNav/>
            <div className="d-sav-grid">
              {[["This Month Savings",`৳${Math.max(incomeSummary.savings||0,0).toLocaleString()}`,`Income − Expenses for ${monthLabel(dashMonth)}`,"var(--green)"],
                ["Carried In",`৳${(incomeSummary.carried_forward||0).toLocaleString()}`,"Savings from previous months","#7c6af7"],
                ["Net Available",`৳${Math.max(incomeSummary.net_savings||0,0).toLocaleString()}`,"Total you can allocate","var(--gold)"],
                ["Lifetime Pool",`৳${(totalSavingsPool.net_savings_pool||0).toLocaleString()}`,"Permanent savings pool","var(--teal)"],
              ].map(([l,v,s,c])=>(<div key={l} className="d-sav-card"><div className="d-sav-lbl">{l}</div><div className="d-sav-val" style={{color:c}}>{v}</div><div className="d-sav-sub">{s}</div></div>))}
            </div>
            <div style={{fontSize:".8rem",fontWeight:700,color:"var(--white2)",marginBottom:12}}>What do you want to do with your savings?</div>
            <div className="d-sav-action-grid">
              <div className="d-sav-action-card">
                <div className="d-sav-action-ico">📅</div><div className="d-sav-action-title">Carry Forward to Next Month</div><div className="d-sav-action-desc">Move some or all of this month&apos;s savings to next month.</div>
                <SavingsActionForm type="carry_forward" fromMonth={dashMonth} toMonth={shiftM(dashMonth,1)} maxAmount={Math.max(incomeSummary.net_savings||0,0)} onSave={async d=>{await createSavingsTransfer(d);await fetchIncomeSummary(dashMonth);show("Savings carried forward!");}}/>
              </div>
              <div className="d-sav-action-card">
                <div className="d-sav-action-ico">🏦</div><div className="d-sav-action-title">Add to Savings Pool</div><div className="d-sav-action-desc">Save permanently — this money stays in your lifetime savings.</div>
                <SavingsActionForm type="pool" fromMonth={dashMonth} toMonth={null} maxAmount={Math.max(incomeSummary.net_savings||0,0)} onSave={async d=>{await createSavingsTransfer(d);show("Added to savings pool!");}}/>
              </div>
              {goals.length>0&&(
                <div className="d-sav-action-card">
                  <div className="d-sav-action-ico">🎯</div><div className="d-sav-action-title">Allocate to a Goal</div><div className="d-sav-action-desc">Use your savings to fund a goal.</div>
                  <div style={{fontSize:".72rem",color:"var(--white3)",marginBottom:8}}>Select a goal:</div>
                  {goals.slice(0,4).map(g=>(<button key={g.id} className="d-fbtn-sec" style={{gridColumn:"auto",marginBottom:6,textAlign:"left",padding:"8px 12px"}} onClick={()=>setAllocGoal({...g,_source:"savings"})}>{g.icon} {g.name} — ৳{Math.max(g.target_amount-g.current_amount,0).toLocaleString()} remaining</button>))}
                </div>
              )}
            </div>
            {savingsTransfers.length>0&&(
              <div className="d-panel"><div className="d-ph"><span className="d-pt">Savings History</span></div>
                {savingsTransfers.slice().reverse().map(st=>(
                  <div key={st.id} className="d-sav-hist-row">
                    <div style={{fontSize:"1.1rem"}}>{st.transfer_type==="pool"?"🏦":"📅"}</div>
                    <div style={{flex:1}}><div style={{fontSize:".8rem",color:"var(--white2)",fontWeight:600}}>{st.transfer_type==="carry_forward"?`Carried to ${monthLabel(st.to_month)}`:st.transfer_type==="pool"?"Added to savings pool":"Loan repayment"}</div><div style={{fontSize:".62rem",color:"var(--white3)"}}>From {monthLabel(st.from_month)}{st.notes?` — ${st.notes}`:""}</div></div>
                    <div style={{fontWeight:700,color:"var(--green)"}}>+৳{st.amount.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* ── LOANS TAB ─────────────────────────────────────────────────── */}
          {activeTab==="loans"&&<>
            <div className="d-sec-title">💳 Loans & Debt Management</div>
            {activeLoans.length>0&&(
              <div className="d-stats" style={{gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",marginBottom:16}}>
                {[["Total Borrowed",`৳${loans.reduce((s,l)=>s+l.amount,0).toLocaleString()}`,`${loans.length} loans`,"#ff6b6b"],
                  ["Outstanding",`৳${totalDebt.toLocaleString()}`,`${activeLoans.length} unpaid`,"#f97316"],
                  ["Paid Off",`৳${loans.reduce((s,l)=>s+(l.amount-l.remaining_amount),0).toLocaleString()}`,`${loans.filter(l=>l.is_paid).length} cleared`,"var(--green)"],
                ].map(([l,v,s,c])=>(<div key={l} className="d-stat" style={{"--ac":c}}><div className="d-stat-lbl">{l}</div><div className="d-stat-val">{v}</div><span className="d-stat-sub">{s}</span></div>))}
              </div>
            )}
            <div className="d-loan-grid">
              <div>
                <div className="d-panel">
                  <div className="d-ph"><span className="d-pt">All Loans</span><span className="d-pbadge">{loans.length} total</span></div>
                  {loans.length===0?<EmptyState icon="💳" title="No loans recorded" sub="Add a loan to track your debt and repayments." action={()=>setModal("loan")} actionLabel="+ Add Loan"/>:loans.map(l=><LoanCard key={l.id} loan={l}/>)}
                </div>
              </div>
              <div>
                <div className="d-panel"><div className="d-ph"><span className="d-pt">Record New Loan</span></div><div className="d-pb"><LoanForm today={today} onSave={async d=>{await addLoan(d);show("Loan recorded!");}}/></div></div>
              </div>
            </div>
          </>}

          {/* ── CATEGORIES TAB ────────────────────────────────────────────── */}
          {activeTab==="categories"&&<>
            <div className="d-sec-title">⊞ Categories</div>
            <div className="d-mgrid">
              <div className="d-gcol">
                <div className="d-panel"><div className="d-ph"><span className="d-pt">All Categories</span><span className="d-pbadge">{cats.length}</span></div>
                  <div className="d-pb">{cats.map(c=>{const meta=cm(c);const isDef=DEF_CATS.includes(c)||c==="Goal"||c==="Loan Repayment";return(
                    <div key={c} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                      <div style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".95rem",borderRadius:8,background:meta.accent+"18",border:`1px solid ${meta.accent}33`,flexShrink:0}}>{meta.icon}</div>
                      <div style={{flex:1,fontSize:".8rem",fontWeight:600,color:"var(--white2)"}}>{c}</div>
                      {isDef?<span style={{fontSize:".52rem",padding:"2px 8px",borderRadius:20,background:"var(--gold-dim)",color:"var(--gold)",border:"1px solid var(--border2)",fontWeight:700,textTransform:"uppercase"}}>DEFAULT</span>:<button className="d-tx-del" onClick={()=>setCats(p=>p.filter(x=>x!==c))}>{TRASH}</button>}
                    </div>
                  );})}</div>
                </div>
              </div>
              <div className="d-gcol"><AddCatForm cats={cats} onAdd={c=>setCats(p=>[...p,c])}/></div>
            </div>
          </>}
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {modal&&!["report","loan"].includes(modal)&&(
        <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setModal(null);}}>
          <div className="d-mbox">
            <div className="d-mhead"><div className="d-mtitle">{modal==="expense"?"Add Expense":modal==="income"?"Add Income":modal==="budget"?"Set Budget":"New Goal"}</div><button className="d-mclose" onClick={()=>setModal(null)}>✕</button></div>
            <div className="d-mbody">
              {modal==="expense"&&<ExpenseForm cats={cats} dashMonth={dashMonth} today={today} onSave={async tx=>{await addTransaction(tx);await fetchSummary(dashMonth);await fetchBudgets(dashMonth);setModal(null);show("Expense added!");}}/>}
              {modal==="income"&&<IncomeForm cats={INCOME_SOURCES} dashMonth={dashMonth} today={today} onSave={async inc=>{await handleIncomeSaved(inc);setModal(null);show("Income added!");}}/>}
              {modal==="budget"&&<BudgetForm cats={cats} dashMonth={dashMonth} onSave={async b=>{await createBudget({...b,month:dashMonth});setModal(null);show("Budget created!");}} isModal/>}
              {modal==="goal"&&<GoalForm count={goals.length} dashMonth={dashMonth} onSave={async g=>{await addGoal(g);setModal(null);show("Goal created!");}}/>}
            </div>
          </div>
        </div>
      )}
      {modal==="loan"&&(
        <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setModal(null);}}>
          <div className="d-mbox">
            <div className="d-mhead"><div className="d-mtitle">💳 Record New Loan</div><button className="d-mclose" onClick={()=>setModal(null)}>✕</button></div>
            <div className="d-mbody"><LoanForm today={today} onSave={async d=>{await addLoan(d);setModal(null);show("Loan recorded!");}}/></div>
          </div>
        </div>
      )}
      {modal==="report"&&<ReportModal userId={user.id} onClose={()=>setModal(null)} fetchMonthlyReport={fetchMonthlyReport} defaultMonth={dashMonth}/>}
      {editTx&&(<div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setEditTx(null);}}><div className="d-mbox"><div className="d-mhead"><div className="d-mtitle">✎ Edit Transaction</div><button className="d-mclose" onClick={()=>setEditTx(null)}>✕</button></div><div className="d-mbody"><EditTxForm tx={editTx} cats={cats} onSave={async fields=>{await updateTransaction(editTx.id,fields,dashMonth);await fetchSummary(dashMonth);setEditTx(null);show("Transaction updated!");}}/></div></div></div>)}
      {editBudget&&(<div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setEditBudget(null);}}><div className="d-mbox"><div className="d-mhead"><div className="d-mtitle">✎ Edit Budget — {editBudget.category}</div><button className="d-mclose" onClick={()=>setEditBudget(null)}>✕</button></div><div className="d-mbody"><EditBudgetForm budget={editBudget} onSave={async fields=>{await updateBudget(editBudget.id,fields,dashMonth);setEditBudget(null);show("Budget updated!");}}/></div></div></div>)}
      {allocGoal&&(<div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setAllocGoal(null);}}><div className="d-mbox"><div className="d-mhead"><div className="d-mtitle">🎯 Allocate to — {allocGoal.name}</div><button className="d-mclose" onClick={()=>setAllocGoal(null)}>✕</button></div><div className="d-mbody"><GoalAllocationForm goal={allocGoal} defaultSource={allocGoal._source||"income"} dashMonth={dashMonth} netSavings={Math.max(incomeSummary.net_savings||0,0)} savingsPool={totalSavingsPool.net_savings_pool||0} onSave={async d=>{await allocateToGoal(d);await fetchTotalSavings();setAllocGoal(null);show(`৳${d.amount.toLocaleString()} allocated to ${allocGoal.name}!`);}}/></div></div></div>)}
      {loanRepayTarget&&(<div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))setLoanRepayTarget(null);}}><div className="d-mbox"><div className="d-mhead"><div className="d-mtitle">💳 Repay — {loanRepayTarget.lender||loanRepayTarget.description||"Loan"}</div><button className="d-mclose" onClick={()=>setLoanRepayTarget(null)}>✕</button></div><div className="d-mbody"><LoanRepayForm loan={loanRepayTarget} dashMonth={dashMonth} today={today} savingsPool={totalSavingsPool.net_savings_pool||0} onSave={async d=>{await addLoanPayment(d);setLoanRepayTarget(null);show(`৳${d.amount.toLocaleString()} repaid!`);}} /></div></div></div>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ExpenseForm({cats,dashMonth,today,onSave}){
  const TODAY_YM=toYM(new Date());
  const[amt,setAmt]=useState("");const[cat,setCat]=useState(cats[0]||"Food");
  const[desc,setDesc]=useState("");const[date,setDate]=useState(dashMonth===TODAY_YM?today:`${dashMonth}-01`);
  const[amtErr,setAmtErr]=useState("");const[dateErr,setDateErr]=useState("");
  const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){let ok=true;if(!amt){setAmtErr("Amount is required");ok=false;}else if(parseFloat(amt)<=0){setAmtErr("Amount must be > 0");ok=false;}else setAmtErr("");if(!date){setDateErr("Date is required");ok=false;}else setDateErr("");return ok;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({category:cat,description:desc,amount:parseFloat(amt),date});}catch(e){setSrvErr(e?.response?.data?.detail||"Failed to save. Please try again.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={setCat}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What did you spend on?"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date</label><DatePickerInput value={date} onChange={v=>{setDate(v);setDateErr("");setSrvErr("");}}/>{dateErr&&<div className="d-ferr">⚠ {dateErr}</div>}</div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Record Expense"}</button>
  </div>);
}

function IncomeForm({cats,dashMonth,today,onSave}){
  const TODAY_YM=toYM(new Date());
  const[amt,setAmt]=useState("");const[source,setSource]=useState(cats[0]||"Salary");
  const[desc,setDesc]=useState("");const[date,setDate]=useState(dashMonth===TODAY_YM?today:`${dashMonth}-01`);
  const[amtErr,setAmtErr]=useState("");const[dateErr,setDateErr]=useState("");
  const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){let ok=true;if(!amt){setAmtErr("Amount is required");ok=false;}else if(parseFloat(amt)<=0){setAmtErr("Amount must be > 0");ok=false;}else setAmtErr("");if(!date){setDateErr("Date is required");ok=false;}else setDateErr("");return ok;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({amount:parseFloat(amt),source,description:desc,date});}catch(e){setSrvErr(e?.response?.data?.detail||"Failed to save income.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Income Source</label><select className="d-finp" value={source} onChange={e=>setSource(e.target.value)}>{cats.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description (optional)</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. April salary, Birthday gift..."/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date</label><DatePickerInput value={date} onChange={v=>{setDate(v);setDateErr("");setSrvErr("");}}/>{dateErr&&<div className="d-ferr">⚠ {dateErr}</div>}</div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Add Income"}</button>
  </div>);
}

function BudgetForm({cats,onSave,isModal}){
  const[cat,setCat]=useState(cats[0]||"Food");const[limit,setLimit]=useState("");const[alert,setAlert]=useState("80");
  const[limitErr,setLimitErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){if(!limit){setLimitErr("Limit is required");return false;}if(parseFloat(limit)<=0){setLimitErr("Limit must be > 0");return false;}setLimitErr("");return true;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({category:cat,monthly_limit:parseFloat(limit),alert_threshold:parseInt(alert)||80});setLimit("");}catch(e){setSrvErr(e?.response?.data?.detail||"Failed to save budget.");}finally{setSaving(false);}}
  const inner=(<div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={v=>{setCat(v);setSrvErr("");}}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Monthly Limit (৳)</label><input className={`d-finp${limitErr?" d-finp-err":""}`} type="number" value={limit} min="0.01" onChange={e=>{setLimit(e.target.value);if(parseFloat(e.target.value)>0)setLimitErr("");setSrvErr("");}} placeholder="5000"/>{limitErr&&<div className="d-ferr">⚠ {limitErr}</div>}</div>
    <div className="d-ff d-s2"><label className="d-flbl">Alert at (%)</label><input className="d-finp" type="number" value={alert} onChange={e=>setAlert(e.target.value)} min="1" max="100"/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Save Budget"}</button>
  </div>);
  if(isModal)return inner;
  return<div className="d-panel"><div className="d-ph"><span className="d-pt">Set / Update Budget</span></div><div className="d-pb">{inner}</div></div>;
}

function GoalForm({count,dashMonth,onSave}){
  const[name,setName]=useState("");const[target,setTarget]=useState("");const[icon,setIcon]=useState("🎯");const[deadline,setDeadline]=useState("");
  const[nameErr,setNameErr]=useState("");const[targetErr,setTargetErr]=useState("");
  const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){let ok=true;if(!name.trim()){setNameErr("Goal name is required");ok=false;}else setNameErr("");if(!target||parseFloat(target)<=0){setTargetErr("Target amount must be > 0");ok=false;}else setTargetErr("");return ok;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({name:name.trim(),target_amount:parseFloat(target),icon,color:GOAL_COLORS[count%GOAL_COLORS.length],deadline:deadline||null,created_month:dashMonth});setName("");setTarget("");setIcon("🎯");setDeadline("");}catch(e){setSrvErr(e?.response?.data?.detail||"Failed to create goal.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Goal Name</label><input className={`d-finp${nameErr?" d-finp-err":""}`} type="text" value={name} onChange={e=>{setName(e.target.value);if(e.target.value.trim())setNameErr("");setSrvErr("");}} placeholder="e.g. New Laptop, Emergency Fund"/>{nameErr&&<div className="d-ferr">⚠ {nameErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Target (৳)</label><input className={`d-finp${targetErr?" d-finp-err":""}`} type="number" value={target} min="0.01" onChange={e=>{setTarget(e.target.value);if(parseFloat(e.target.value)>0)setTargetErr("");setSrvErr("");}} placeholder="0.00"/>{targetErr&&<div className="d-ferr">⚠ {targetErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Icon (emoji)</label><input className="d-finp" type="text" value={icon} onChange={e=>setIcon(e.target.value)} maxLength={2}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Deadline (optional)</label><DatePickerInput value={deadline} onChange={setDeadline}/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Create Goal"}</button>
  </div>);
}

function GoalAllocationForm({goal,defaultSource,dashMonth,netSavings,savingsPool,onSave}){
  const[amt,setAmt]=useState("");const[source,setSource]=useState(defaultSource||"income");const[notes,setNotes]=useState("");
  const[amtErr,setAmtErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  const remaining=Math.max(goal.target_amount-goal.current_amount,0);
  const available=source==="savings"?savingsPool:netSavings;
  function validate(){
    if(!amt){setAmtErr("Amount is required");return false;}
    if(parseFloat(amt)<=0){setAmtErr("Amount must be > 0");return false;}
    if(source==="savings"&&parseFloat(amt)>savingsPool){setAmtErr(`Cannot exceed savings pool balance (৳${savingsPool.toLocaleString()})`);return false;}
    setAmtErr("");return true;
  }
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({goal_id:goal.id,amount:parseFloat(amt),month:dashMonth,source,notes});}catch(e){setSrvErr(e?.response?.data?.detail||"Allocation failed. Please try again.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff d-s2" style={{background:"rgba(232,184,75,.06)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px"}}>
      <div style={{fontSize:".65rem",color:"var(--white3)",marginBottom:4}}>Goal Progress</div>
      <div style={{fontWeight:700,color:"var(--gold)"}}>৳{goal.current_amount.toLocaleString()} / ৳{goal.target_amount.toLocaleString()}</div>
      <div style={{fontSize:".65rem",color:"var(--white3)",marginTop:2}}>৳{remaining.toLocaleString()} remaining</div>
    </div>
    <div className="d-ff d-s2"><label className="d-flbl">Source</label>
      <select className="d-finp" value={source} onChange={e=>{setSource(e.target.value);setAmtErr("");setSrvErr("");}}>
        <option value="income">From Income (counted as monthly expense)</option>
        <option value="savings">From Savings Pool (deducts from lifetime pool)</option>
      </select>
      <div style={{fontSize:".62rem",color:"var(--white3)",marginTop:4}}>
        {source==="income"?"This will appear as a 'Goal' expense this month.":"Deducts from your lifetime savings pool."}
        {" "}Available: <span style={{color:source==="savings"?"var(--teal)":"var(--green)"}}>৳{available.toLocaleString()}</span>
      </div>
    </div>
    <div className="d-ff d-s2"><label className="d-flbl">Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff d-s2"><label className="d-flbl">Notes (optional)</label><input className="d-finp" type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. April contribution"/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Allocate to Goal"}</button>
  </div>);
}

function SavingsActionForm({type,fromMonth,toMonth,maxAmount,onSave}){
  const[amt,setAmt]=useState("");const[notes,setNotes]=useState("");const[amtErr,setAmtErr]=useState("");
  const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){if(!amt){setAmtErr("Amount is required");return false;}if(parseFloat(amt)<=0){setAmtErr("Amount must be > 0");return false;}if(parseFloat(amt)>maxAmount){setAmtErr(`Cannot exceed available savings (৳${maxAmount.toLocaleString()})`);return false;}setAmtErr("");return true;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({amount:parseFloat(amt),from_month:fromMonth,to_month:toMonth,transfer_type:type,notes});setAmt("");setNotes("");}catch(e){setSrvErr(e?.response?.data?.detail||"Transfer failed.");}finally{setSaving(false);}}
  return(<div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div><label className="d-flbl" style={{marginBottom:4,display:"block"}}>Amount (৳) — max ৳{maxAmount.toLocaleString()}</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <input className="d-finp" type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)"/>
    {srvErr&&<SrvErr msg={srvErr}/>}
    <button className="btn-dash-p" style={{padding:"8px 14px",fontSize:".78rem"}} onClick={submit} disabled={saving}>{saving?"Saving…":type==="carry_forward"?"Carry Forward →":"Save to Pool 🏦"}</button>
  </div>);
}

function LoanForm({today,onSave}){
  const[amt,setAmt]=useState("");const[lender,setLender]=useState("");const[desc,setDesc]=useState("");const[date,setDate]=useState(today);
  const[amtErr,setAmtErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){if(!amt||parseFloat(amt)<=0){setAmtErr("Loan amount must be > 0");return false;}setAmtErr("");return true;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({amount:parseFloat(amt),lender:lender.trim(),description:desc.trim(),date});setAmt("");setLender("");setDesc("");setDate(today);}catch(e){setSrvErr(e?.response?.data?.detail||"Failed to record loan.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Loan Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Lender (Person / Bank)</label><input className="d-finp" type="text" value={lender} onChange={e=>setLender(e.target.value)} placeholder="e.g. John Doe, BRAC Bank"/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Emergency loan, Car purchase..."/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date Borrowed</label><DatePickerInput value={date} onChange={setDate}/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Record Loan"}</button>
  </div>);
}

function LoanRepayForm({loan,dashMonth,today,savingsPool,onSave}){
  const[amt,setAmt]=useState("");const[source,setSource]=useState("income");const[date,setDate]=useState(today);const[notes,setNotes]=useState("");
  const[amtErr,setAmtErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){
    if(!amt||parseFloat(amt)<=0){setAmtErr("Payment amount must be > 0");return false;}
    if(parseFloat(amt)>loan.remaining_amount){setAmtErr(`Cannot exceed remaining balance (৳${loan.remaining_amount.toLocaleString()})`);return false;}
    if(source==="savings"&&parseFloat(amt)>savingsPool){setAmtErr(`Insufficient savings pool (৳${savingsPool.toLocaleString()} available)`);return false;}
    setAmtErr("");return true;
  }
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({loan_id:loan.id,amount:parseFloat(amt),source,month:date.slice(0,7),date,notes});}catch(e){setSrvErr(e?.response?.data?.detail||"Payment failed.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff d-s2" style={{background:"rgba(255,107,107,.06)",border:"1px solid rgba(255,107,107,.2)",borderRadius:10,padding:"12px"}}>
      <div style={{fontSize:".65rem",color:"var(--white3)",marginBottom:4}}>{loan.lender?"Lender: "+loan.lender:"Loan"} — Repayment</div>
      <div style={{fontWeight:700,color:"#ff6b6b"}}>৳{loan.remaining_amount.toLocaleString()} remaining of ৳{loan.amount.toLocaleString()}</div>
    </div>
    <div className="d-ff d-s2"><label className="d-flbl">Source</label>
      <select className="d-finp" value={source} onChange={e=>{setSource(e.target.value);setAmtErr("");setSrvErr("");}}>
        <option value="income">From Income (adds as monthly expense)</option>
        <option value="savings">From Savings Pool (deducts from lifetime pool)</option>
      </select>
      {source==="savings"&&<div style={{fontSize:".62rem",color:"var(--teal)",marginTop:4}}>Available pool: ৳{savingsPool.toLocaleString()}</div>}
    </div>
    <div className="d-ff d-s2"><label className="d-flbl">Payment Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" step="0.01" onChange={e=>{setAmt(e.target.value);setAmtErr("");setSrvErr("");}} placeholder="0.00"/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff d-s2"><label className="d-flbl">Payment Date</label><DatePickerInput value={date} onChange={setDate}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Notes (optional)</label><input className="d-finp" type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Monthly installment"/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Make Payment"}</button>
  </div>);
}

function AddCatForm({cats,onAdd}){
  const[val,setVal]=useState("");
  function submit(){if(!val.trim()||cats.includes(val.trim()))return;onAdd(val.trim());setVal("");}
  return(<div className="d-panel"><div className="d-ph"><span className="d-pt">Add New Category</span></div><div className="d-pb"><div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Category Name</label><input className="d-finp" type="text" value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. Healthcare, Gym..."/></div>
    {val.trim()&&<div className="d-ff d-s2"><div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--gold-dim)",border:"1px solid var(--border2)",borderRadius:8}}><span style={{fontSize:"1.2rem"}}>{getIcon(val)}</span><span style={{fontSize:".72rem",color:"var(--gold)"}}>Auto icon: {getIcon(val)}</span></div></div>}
    <button className="d-fbtn" onClick={submit}>Add Category</button>
  </div></div></div>);
}

function DatePickerInput({value,onChange}){
  return(<div style={{position:"relative"}}><input className="d-finp" type="date" value={value} onChange={e=>onChange(e.target.value)} style={{colorScheme:"dark",cursor:"pointer"}}/></div>);
}

function CategorySelect({cats,value,onChange}){
  const[adding,setAdding]=useState(false);const[newCat,setNewCat]=useState("");
  function handleChange(e){if(e.target.value==="__add_new__"){setAdding(true);}else onChange(e.target.value);}
  function confirmNew(){const t=newCat.trim();if(!t){setAdding(false);return;}if(!cats.includes(t))cats.push(t);onChange(t);setAdding(false);setNewCat("");}
  if(adding)return(<div style={{display:"flex",gap:6}}><input className="d-finp" autoFocus value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmNew();if(e.key==="Escape"){setAdding(false);setNewCat("");}}} placeholder="New category name…" style={{flex:1}}/><button className="d-tx-edit" style={{padding:"0 10px",fontSize:".8rem",borderRadius:6}} onClick={confirmNew}>✓</button><button className="d-tx-del" style={{padding:"0 8px"}} onClick={()=>{setAdding(false);setNewCat("");}}>✕</button></div>);
  return(<select className="d-finp" value={value} onChange={handleChange}>{cats.map(c=><option key={c} value={c}>{c}</option>)}<option disabled>──────────</option><option value="__add_new__">＋ Add new category…</option></select>);
}

function EditTxForm({tx,cats,onSave}){
  const[amt,setAmt]=useState(String(tx.amount));const[cat,setCat]=useState(tx.category);const[desc,setDesc]=useState(tx.description||"");const[date,setDate]=useState(tx.date);
  const[amtErr,setAmtErr]=useState("");const[dateErr,setDateErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){let ok=true;if(!amt||parseFloat(amt)<=0){setAmtErr("Amount must be > 0");ok=false;}else setAmtErr("");if(!date){setDateErr("Date is required");ok=false;}else setDateErr("");return ok;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({amount:parseFloat(amt),category:cat,description:desc,date});}catch(e){setSrvErr(e?.response?.data?.detail||"Update failed.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff"><label className="d-flbl">Amount (৳)</label><input className={`d-finp${amtErr?" d-finp-err":""}`} type="number" value={amt} min="0.01" onChange={e=>{setAmt(e.target.value);if(parseFloat(e.target.value)>0)setAmtErr("");setSrvErr("");}}/>{amtErr&&<div className="d-ferr">⚠ {amtErr}</div>}</div>
    <div className="d-ff"><label className="d-flbl">Category</label><CategorySelect cats={cats} value={cat} onChange={setCat}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Description</label><input className="d-finp" type="text" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
    <div className="d-ff d-s2"><label className="d-flbl">Date</label><DatePickerInput value={date} onChange={v=>{setDate(v);setDateErr("");setSrvErr("");}}/>{dateErr&&<div className="d-ferr">⚠ {dateErr}</div>}</div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Save Changes"}</button>
  </div>);
}

function EditBudgetForm({budget,onSave}){
  const[limit,setLimit]=useState(String(budget.monthly_limit));const[alert,setAlert]=useState(String(budget.alert_threshold??80));
  const[limitErr,setLimitErr]=useState("");const[srvErr,setSrvErr]=useState("");const[saving,setSaving]=useState(false);
  function validate(){if(!limit||parseFloat(limit)<=0){setLimitErr("Limit must be > 0");return false;}setLimitErr("");return true;}
  async function submit(){if(!validate())return;setSrvErr("");setSaving(true);try{await onSave({monthly_limit:parseFloat(limit),alert_threshold:parseInt(alert)||80});}catch(e){setSrvErr(e?.response?.data?.detail||"Update failed.");}finally{setSaving(false);}}
  return(<div className="d-fgrid">
    <div className="d-ff d-s2"><label className="d-flbl">Category</label><div style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:8,fontSize:".85rem",color:"var(--gold)",fontWeight:600}}>{budget.category}</div></div>
    <div className="d-ff d-s2"><label className="d-flbl">Monthly Limit (৳)</label><input className={`d-finp${limitErr?" d-finp-err":""}`} type="number" value={limit} min="0.01" onChange={e=>{setLimit(e.target.value);if(parseFloat(e.target.value)>0)setLimitErr("");setSrvErr("");}}/>{limitErr&&<div className="d-ferr">⚠ {limitErr}</div>}</div>
    <div className="d-ff d-s2"><label className="d-flbl">Alert at (%)</label><input className="d-finp" type="number" value={alert} onChange={e=>setAlert(e.target.value)} min="1" max="100"/></div>
    <SrvErr msg={srvErr}/>
    <button className="d-fbtn" onClick={submit} disabled={saving}>{saving?"Saving…":"Save Changes"}</button>
  </div>);
}

function ReportModal({userId,onClose,fetchMonthlyReport,defaultMonth}){
  const[reportMonth,setReportMonth]=useState(defaultMonth||toYM(new Date()));
  const[report,setReport]=useState(null);const[loading,setLoading]=useState(false);
  const TODAY_YM=toYM(new Date());
  const load=useCallback(async(m)=>{setLoading(true);setReport(null);try{const r=await fetchMonthlyReport(m);setReport(r);}catch{}finally{setLoading(false);}},[ fetchMonthlyReport]);
  useEffect(()=>{load(reportMonth);},[]);// eslint-disable-line
  function changeMonth(m){setReportMonth(m);load(m);}
  const savings=report?(report.total_income||0)-(report.total_spent||0):0;
  const pieSlices=[
    {name:"Income",value:report?.total_income||0,fill:"#2dd4bf"},
    {name:"Spending",value:report?.total_spent||0,fill:"#ff6b6b"},
    {name:"Savings",value:Math.max(savings,0),fill:"#4ade80"},
  ];
  return(
    <div className="d-moverlay" onClick={e=>{if(e.target.classList.contains("d-moverlay"))onClose();}}>
      <div className="d-mbox" style={{maxWidth:700}}>
        <div className="d-mhead"><div className="d-mtitle">📊 Monthly Report</div><button className="d-mclose" onClick={onClose}>✕</button></div>
        <div className="d-report-nav">
          <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} onClick={()=>changeMonth(shiftM(reportMonth,-1))}>‹</button>
          <select value={reportMonth} onChange={e=>changeMonth(e.target.value)}>{getLast24Months().map(m=><option key={m.value} value={m.value}>{m.display}</option>)}</select>
          <button className="btn-dash-o" style={{padding:"4px 12px",fontSize:".9rem"}} disabled={reportMonth>=TODAY_YM} onClick={()=>changeMonth(shiftM(reportMonth,1))}>›</button>
        </div>
        <div style={{padding:"20px 24px",maxHeight:"68vh",overflowY:"auto"}}>
          {loading&&<p style={{textAlign:"center",color:"var(--white3)",padding:40}}>Loading {monthLabel(reportMonth)}…</p>}
          {!loading&&report&&<>
            {/* 3-slice pie */}
            {((report.total_income||0)+(report.total_spent||0))>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:".78rem",fontWeight:700,color:"var(--violet)",marginBottom:10}}>Income vs Spending vs Savings</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"center"}}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieSlices} dataKey="value" cx="50%" cy="50%" outerRadius={85} innerRadius={52} strokeWidth={0}>
                        {pieSlices.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                      </Pie>
                      <Tooltip formatter={v=>[`৳${Number(v).toLocaleString()}`]} contentStyle={{background:"#1c1c28",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,fontSize:11}}/>
                      <Legend formatter={v=><span style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {pieSlices.map(s=>(
                      <div key={s.name}><div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",marginBottom:4}}><span style={{color:"var(--white3)"}}>{s.name}</span><span style={{color:s.fill,fontWeight:700}}>৳{s.value.toLocaleString()}</span></div><div style={{height:5,background:"rgba(255,255,255,.06)",borderRadius:3}}><div style={{height:"100%",background:s.fill,borderRadius:3,width:(report.total_income>0?Math.min(s.value/report.total_income*100,100):0)+"%",transition:"width .4s"}}/></div></div>
                    ))}
                    {savings<0&&<div style={{fontSize:".65rem",color:"#ff6b6b",background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.2)",borderRadius:7,padding:"6px 10px",marginTop:4}}>⚠ Spending exceeded income by ৳{Math.abs(savings).toLocaleString()}</div>}
                  </div>
                </div>
              </div>
            )}
            {/* Bar chart + table */}
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:12,padding:"18px 20px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:".65rem",color:"var(--white3)",marginBottom:6}}>TOTAL SPENT — {monthLabel(reportMonth).toUpperCase()}</div>
              <div style={{fontFamily:"sans-serif",fontSize:"2rem",fontWeight:900,color:"var(--gold)"}}>৳{report.total_spent?.toFixed(2)||"0.00"}</div>
            </div>
            {Object.keys(report.category_breakdown||{}).length>0?<>
              <div style={{marginBottom:12,fontSize:".78rem",fontWeight:700,color:"var(--violet)"}}>Spending by Category</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(report.category_breakdown).map(([name,value])=>({name,value}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}}/>
                  <YAxis tick={{fontSize:10,fill:"rgba(255,255,255,.4)"}} tickFormatter={v=>`৳${v}`}/>
                  <Tooltip formatter={v=>[`৳${Number(v).toFixed(2)}`,"Spent"]} contentStyle={{background:"#1e1e2e",border:"1px solid #333"}}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>{Object.keys(report.category_breakdown).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <table style={{width:"100%",borderCollapse:"collapse",marginTop:20,fontSize:".78rem"}}>
                <thead><tr style={{borderBottom:"1px solid var(--border)"}}><th style={{textAlign:"left",padding:"6px 8px",color:"var(--white3)",fontSize:".6rem"}}>CATEGORY</th><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontSize:".6rem"}}>SPENT</th>{report.budget_comparison&&<><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontSize:".6rem"}}>BUDGET</th><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontSize:".6rem"}}>USED</th><th style={{textAlign:"right",padding:"6px 8px",color:"var(--white3)",fontSize:".6rem"}}>STATUS</th></>}</tr></thead>
                <tbody>{Object.entries(report.category_breakdown).map(([cat,amt])=>{const b=report.budget_comparison?.[cat];return<tr key={cat} style={{borderBottom:"1px solid var(--border)"}}><td style={{padding:"8px"}}><span style={{background:cm(cat).accent+"22",border:`1px solid ${cm(cat).accent}44`,color:cm(cat).accent,padding:"2px 8px",borderRadius:20,fontSize:".68rem"}}>{cm(cat).icon} {cat}</span></td><td style={{textAlign:"right",padding:"8px",fontFamily:"sans-serif",color:"var(--gold)"}}>৳{Number(amt).toFixed(2)}</td>{report.budget_comparison&&b&&<><td style={{textAlign:"right",padding:"8px",color:"var(--white3)"}}>৳{Number(b.budget).toFixed(2)}</td><td style={{textAlign:"right",padding:"8px",fontWeight:700,color:b.is_over_budget?"#ff6b6b":"#4ade80"}}>{Number(b.percentage_used).toFixed(1)}%</td><td style={{textAlign:"right",padding:"8px"}}>{b.is_over_budget?<span style={{color:"#ff6b6b",fontSize:".65rem"}}>⚠ Over ৳{(amt-b.budget).toFixed(0)}</span>:<span style={{color:"#4ade80"}}>✓</span>}</td></>}{report.budget_comparison&&!b&&<td colSpan={3} style={{textAlign:"right",padding:"8px",color:"#555",fontStyle:"italic",fontSize:".68rem"}}>No budget</td>}</tr>;})}
                </tbody>
              </table>
              {report.budget_comparison&&Object.values(report.budget_comparison).some(b=>b.is_over_budget)&&(
                <div style={{marginTop:16,background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.25)",borderRadius:8,padding:14}}>
                  <div style={{color:"#ff6b6b",fontWeight:700,fontSize:".8rem",marginBottom:8}}>🚨 Over Budget Categories</div>
                  {Object.entries(report.budget_comparison).filter(([,b])=>b.is_over_budget).map(([cat,b])=>(<div key={cat} style={{fontSize:".75rem",marginBottom:4}}><strong>{cat}</strong>: overspent ৳{(b.spent-b.budget).toFixed(2)} <span style={{color:"#ff6b6b"}}>({b.percentage_used.toFixed(1)}%)</span></div>))}
                </div>
              )}
            </>:<p style={{textAlign:"center",color:"var(--white3)",padding:30}}>No transactions for {monthLabel(reportMonth)}.</p>}
          </>}
        </div>
      </div>
    </div>
  );
}
