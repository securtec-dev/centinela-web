import React,{useEffect,useState} from 'react';
import { billingOptions, call, plans, t } from './api.js';

const statuses = {sent:['Enviado','Received'],contacted:['Contactado','Contacted'],customer:['Cliente','Customer'],archived:['Archivado','Archived']};
const sources = {web:['Web propia','Website'],dojo:['Dojo','Dojo'],direct:['Directo','Direct']};

function Field({ label,name,value,type='text',required=false,options,autoComplete }) {
  return <label className="field"><span>{label}</span>{type==='area'
    ? <textarea name={name} defaultValue={value??''} rows={4}/> : options
    ? <select name={name} defaultValue={value??''}>{options.map(option=><option value={option.id} key={option.id}>{option.name}</option>)}</select>
    : <input name={name} type={type} defaultValue={value} required={required} autoComplete={autoComplete}
        min={type==='number'?1:undefined} max={type==='number'?1000000:undefined}/>}</label>;
}

function Client({language, row, onSave, onCancel}) {
  const l=(es,en)=>t(language,es,en);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <section className="business-card"><header><div><span className="reference">{row.reference}</span><h2>{row.company}</h2></div>
    <button className="outline" onClick={onCancel}>{l('Cerrar ficha','Close record')}</button></header>
    <form key={row.updated_at} className="fields" onSubmit={async event=>{
      event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
      setError('');setMessage('');setBusy(true);
      try {const saved=await call('admin/leads/'+row.id,language,{method:'PATCH',data:{...data,employees:Number(data.employees)}});
        onSave(saved);setMessage(l('Ficha guardada.','Record saved.'));}
      catch(err){setError(err.message);}finally{setBusy(false);}
    }}>
      {[
        ['company','Empresa','Company','text'],['contact','Contacto','Contact','text'],['whatsapp','WhatsApp','WhatsApp','tel'],
        ['email','Correo','Email','email'],['company_type','Tipo de empresa','Business type','text'],['employees','Personas','People','number'],
        ['domain','Dominio','Domain','text'],['installation_date','Fecha de instalación','Installation date','date'],
        ['renewal_date','Fecha de renovación','Renewal date','date'],
      ].map(([name,es,en,type])=><Field key={name} name={name} label={l(es,en)} type={type}
        value={row[name]} required={['company','contact','whatsapp','email','company_type','employees'].includes(name)}/>)}
      <Field name="plan" label={l('Plan','Plan')} value={row.plan}
        options={[{id:'',name:l('Sin seleccionar','Unselected')},...plans.map(plan=>({id:plan.id,name:l(plan.es,plan.en)}))]}/>
      <Field name="billing" label={l('Modalidad de interés','Preferred billing')} value={row.billing}
        options={[{id:'',name:l('Por decidir','Undecided')},...Object.entries(billingOptions).map(([id,labels])=>({id,name:l(...labels)}))]}/>
      <Field name="origin" label={l('Origen','Source')} value={row.origin}
        options={Object.entries(sources).map(([id,names])=>({id,name:l(...names)}))}/>
      <Field name="status" label={l('Estado comercial','Commercial status')} value={row.status}
        options={Object.entries(statuses).map(([id,names])=>({id,name:l(...names)}))}/>
      <p className="status-payment">{l('Pago pendiente','Payment pending')}</p>
      <div className="full"><Field name="notes" label={l('Notas privadas','Private notes')} value={row.notes} type="area"/></div>
      {error&&<p className="feedback error full" role="alert">{error}</p>}
      {message&&<p className="feedback full" role="status">{message}</p>}
      <div className="full"><button className="primary" disabled={busy}>{busy?l('Guardando…','Saving…'):l('Guardar ficha','Save record')}</button></div>
    </form>
  </section>;
}

export function Admin({language,setLanguage}) {
  const l=(es,en)=>t(language,es,en);
  const [session,setSession]=useState(null),[ready,setReady]=useState(false),[leads,setLeads]=useState(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[chosen,setChosen]=useState(null);
  useEffect(()=>{call('admin/session',language).then(setSession).catch(err=>{
    if (err.status!==401) setError(err.message);
  }).finally(()=>setReady(true));},[]);
  useEffect(()=>{
    if (!session) return;
    let active=true;
    call('admin/leads',language).then(rows=>{
      if (active) { setLeads(rows);setError(''); }
    }).catch(err=>{
      if (active) setError(err.message);
    });
    return ()=>{active=false;};
  },[session,language]);
  const matches = (leads??[]).filter(row => (filter==='all'||row.status===filter)&&
    [row.company,row.reference,row.contact,row.email].some(value=>value.toLowerCase().includes(query.trim().toLowerCase())));
  return <main className="business">
    <header className="business-top"><a className="brand" href="/"><img src="/centinela-icon.png" alt=""/><strong>Centinela ERP</strong></a>
      <div className="line"><button className="outline" onClick={()=>setLanguage(language==='es'?'en':'es')}>{language==='es'?'English':'Español'}</button>
        {session&&<button className="outline" onClick={async()=>{
          try{await call('admin/session',language,{method:'DELETE'});setSession(null);setLeads(null);setChosen(null);setFilter('all');setQuery('');setError('');}
          catch(err){setError(err.message);}
        }}>{l('Salir','Sign out')}</button>}</div></header>
    {!ready?<p>{l('Cargando…','Loading…')}</p>:!session?<section className="business-card login">
      <h1>{l('Panel privado','Private dashboard')}</h1>
      <form className="fields" onSubmit={async event=>{
        event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setError('');
        try{setSession(await call('admin/login',language,{method:'POST',data}));}
        catch(err){setError(err.message);}finally{setBusy(false);}
      }}>
        <Field label={l('Usuario','Username')} name="username" autoComplete="username" required/>
        <Field label={l('Contraseña','Password')} name="password" type="password" autoComplete="current-password" required/>
        {error&&<p role="alert" className="feedback error">{error}</p>}
        <button className="primary" disabled={busy}>{l('Entrar','Sign in')}</button>
      </form>
    </section>:<>
      <div className="business-heading"><div><p className="eyebrow">{l('Panel comercial','Sales dashboard')}</p><h1>{l('Solicitudes y clientes','Requests and customers')}</h1></div>
        <div className="business-count"><strong>{leads?.filter(row=>row.status==='sent').length??'—'}</strong>{l('Solicitudes nuevas','New requests')}</div>
        <div className="business-count"><strong>{leads?.filter(row=>row.status==='customer').length??'—'}</strong>{l('Clientes','Customers')}</div></div>
      {error&&<p className="feedback error" role="alert">{error}</p>}
      {chosen&&<Client key={chosen.id} row={chosen} language={language} onCancel={()=>setChosen(null)}
        onSave={row=>{setChosen(row);setLeads(items=>items.map(item=>item.id===row.id?row:item));}}/>}
      <section className="business-card"><header className="line"><input aria-label={l('Buscar','Search')}
        placeholder={l('Buscar por empresa o solicitud','Search by company or request')} value={query} onChange={e=>setQuery(e.target.value)}/>
        <select aria-label={l('Estado','Status')} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">{l('Todos los estados','All statuses')}</option>
          {Object.entries(statuses).map(([key,names])=><option key={key} value={key}>{l(...names)}</option>)}</select></header>
        {leads===null&&!error&&<p role="status">{l('Cargando solicitudes…','Loading requests…')}</p>}
        {leads!==null&&(matches.length?<div className="table-scroll"><table><thead><tr>
          {[l('Empresa','Company'),l('Contacto','Contact'),l('Origen','Source'),l('Plan','Plan'),l('Estado','Status'),l('Dominio','Domain'),''].map((name,i)=><th key={i}>{name}</th>)}
        </tr></thead><tbody>{matches.map(row=><tr key={row.id}><td><strong>{row.company}</strong><small>{row.reference}</small></td><td>{row.contact}<small>{row.email}</small></td>
          <td>{l(...sources[row.origin])}</td><td>{plans.find(plan=>plan.id===row.plan)?.[language]??'—'}
            {billingOptions[row.billing]&&<small>{l(...billingOptions[row.billing])}</small>}</td><td>{l(...statuses[row.status])}<small>{l('Pago pendiente','Payment pending')}</small></td><td>{row.domain||'—'}</td>
          <td><button className="outline" onClick={()=>setChosen(row)}>{l('Abrir','Open')}</button></td></tr>)}</tbody></table></div>
          :<p>{l('No hay fichas que coincidan.','No matching records.')}</p>)}
      </section>
    </>}
  </main>;
}
