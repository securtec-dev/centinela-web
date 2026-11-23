import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Admin} from './Admin.jsx';
import {billingOptions,call,plans,t} from './api.js';
import './styles.css';

const demos=[
  {id:'puestos',es:'Configurar puestos',en:'Set up posts',
    stepsEs:['Abre Puestos y crea una ubicación operativa.','Registra sus coordenadas y define si requiere relevo.','Agrega puntos de ronda e imprime sus etiquetas QR.'],
    stepsEn:['Open Posts and create an operational location.','Record the coordinates and decide if the post requires a handover.','Add patrol checkpoints and print their QR labels.']},
  {id:'personal',es:'Cargar personal',en:'Add personnel',
    stepsEs:['Abre Personal y agrega a la persona con su cargo.','Guarda la foto y genera el carnet o la etiqueta QR.','Emite un código de un solo uso para iniciar el APK.'],
    stepsEn:['Open Personnel and add the person and role.','Save a photo and generate the card or QR label.','Issue a one-time code to sign in to the APK.']},
  {id:'planilla',es:'Preparar planilla',en:'Prepare payroll',
    stepsEs:['Configura feriados y el tratamiento del día 31.','Prepara una quincena y revisa horas, extras y exclusiones.','Exporta a Excel o CSV cuando termine la revisión.'],
    stepsEn:['Configure holidays and how day 31 is counted.','Prepare a pay period and review hours, overtime and exclusions.','Export to Excel or CSV when the review is complete.']},
  {id:'monitoreo',es:'Capacitar a Monitoreo',en:'Train Monitoring',
    stepsEs:['Abre la bandeja y activa los avisos sonoros.','Revisa la solicitud, sus horas y la ubicación si está disponible.','Marca la alerta como vista y resuelve con el permiso que corresponda.'],
    stepsEn:['Open the inbox and enable audible alerts.','Review the request, timestamps and location if available.','Mark the alert as seen and resolve it with the appropriate permission.']},
];

function Brand({language}) {
  return <a className="brand" href="#"><img src="/centinela-icon.png" alt=""/><span><strong>Centinela ERP</strong>
    <small>{t(language,'Seguridad y Planilla','Security & Payroll')}</small></span></a>;
}

function WorkflowVisual({language}) {
  const l=(es,en)=>t(language,es,en);
  const cards=[
    ['◴',l('Turnos y relevos','Shifts and handovers'),l('Programación y cobertura por puesto','Post schedules and coverage')],
    ['◉',l('Asistencia','Attendance'),l('Entradas, salidas y evidencia','Clock-ins, clock-outs and evidence')],
    ['◇',l('Rondas','Patrols'),l('Marcas QR y revisión con Monitoreo','QR checkpoints and Monitoring review')],
    ['▤',l('Planilla','Payroll'),l('Horas revisadas y exportaciones','Reviewed hours and exports')],
  ];
  return <div className="workflow" aria-hidden="true">
    <div className="workflow-top"><img className="visual-mark" src="/centinela-icon.png" alt=""/><div><b>Centinela ERP</b><small>{l('Centro de operación','Operations workspace')}</small></div></div>
    <div className="workflow-body">
      <div className="workflow-rail"><span></span><span></span><span></span><span></span></div>
      <div className="workflow-cards">{cards.map(([icon,title,subtitle])=><div className="visual-card" key={title}>
        <span className="visual-icon">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>)}</div>
    </div>
  </div>;
}

function DemoSection({language}) {
  const l=(es,en)=>t(language,es,en);
  const [selected,setSelected]=useState(0),[failed,setFailed]=useState({});
  const item=demos[selected];
  const videoKey=item.id+'-'+language;
  return <section id="demos" className="slice demos">
    <div className="wrap">
      <div className="heading"><p className="eyebrow">{l('Demostraciones','Walkthroughs')}</p>
        <h2>{l('De la configuración al primer turno','From setup to the first shift')}</h2></div>
      <div className="demo-layout"><div className="demo-tabs" role="group" aria-label={l('Demostraciones','Walkthroughs')}>
        {demos.map((demo,index)=><button key={demo.id} className={selected===index?'demo-tab selected':'demo-tab'}
          aria-pressed={selected===index} onClick={()=>setSelected(index)}>
          {demo[language]} <span aria-hidden="true">→</span></button>)}
      </div><article className="demo-card"><h3>{item[language]}</h3>
        {failed[videoKey]?
          <p className="feedback error" role="alert">{l('El video no está disponible. Puedes seguir los pasos de abajo.','The video is unavailable. You can follow the steps below.')}</p>:
          <video key={videoKey} controls playsInline preload="none"
            onError={()=>setFailed(previous=>({...previous,[videoKey]:true}))} aria-label={item[language]}
            src={`/demos/${videoKey}.webm`} />}
        <ol>{(language==='en'?item.stepsEn:item.stepsEs).map(step=><li key={step}>{step}</li>)}</ol>
      </article></div>
    </div>
  </section>;
}

function LeadForm({language,plan,setPlan,preferredBilling,setPreferredBilling}) {
  const l=(es,en)=>t(language,es,en);
  const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <section className="slice contact" id="solicitar">
    <div className="wrap contact-grid"><div><p className="eyebrow">{l('Contacto','Contact')}</p>
      <h2>{l('Solicitar información','Request information')}</h2>
      <p>{l('Indícanos cómo opera tu empresa. Yeison se pondrá en contacto para revisar la instalación y responder tus preguntas.',
        'Tell us how your company operates. Yeison will contact you to discuss installation and answer your questions.')}</p></div>
      {result?<div className="lead-form receipt" role="status"><strong>{l('Solicitud recibida','Request received')}</strong>
        <span>{result.reference}</span><p>{l('Guarda este número. Yeison se pondrá en contacto contigo.','Keep this reference. Yeison will be in touch.')}</p>
        <button className="outline" onClick={()=>setResult(null)}>{l('Enviar otra solicitud','Send another request')}</button></div>:
      <form className="lead-form fields" onSubmit={async event=>{
        event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setError('');
        try{setResult(await call('leads',language,{method:'POST',data:{...values,employees:Number(values.employees)}}));}
        catch(err){setError(err.message);}finally{setBusy(false);}
      }}>
        {[['company','Empresa','Company','text',150,'organization'],['contact','Nombre de contacto','Contact name','text',120,'name'],
          ['whatsapp','WhatsApp','WhatsApp','tel',48,'tel'],['email','Correo','Email','email',254,'email'],
          ['company_type','Tipo de empresa','Business type','text',100],['employees','Cantidad de personas','Number of people','number',1000000]]
          .map(([name,es,en,type,max,autoComplete])=><label className="field" key={name}><span>{l(es,en)}</span><input required name={name} type={type} autoComplete={autoComplete}
            min={type==='number'?1:undefined} max={type==='number'?max:undefined} maxLength={type==='number'?undefined:max}/></label>)}
        <label className="field"><span>{l('Plan de interés','Plan of interest')}</span><select name="plan" value={plan} onChange={event=>setPlan(event.target.value)}>
          <option value="">{l('Quiero conocer los planes','I want to compare plans')}</option>
          {plans.map(row=><option value={row.id} key={row.id}>{l(row.es,row.en)}</option>)}</select></label>
        <label className="field"><span>{l('Modalidad de interés','Preferred billing')}</span>
          <select name="billing" value={preferredBilling} onChange={event=>setPreferredBilling(event.target.value)}>
            <option value="">{l('Por decidir','Undecided')}</option>
            {Object.entries(billingOptions).map(([value,labels])=><option value={value} key={value}>{l(...labels)}</option>)}
          </select></label>
        <p className="full form-note">{l('Usaremos estos datos para responder a tu solicitud.','We will use these details to respond to your request.')}</p>
        {error&&<p className="feedback error full" role="alert">{error}</p>}
        <div className="full"><button className="primary" disabled={busy}>{busy?l('Enviando…','Sending…'):l('Enviar solicitud','Send request')}</button></div>
      </form>}
    </div>
  </section>;
}

function Home({language,setLanguage}) {
  const l=(es,en)=>t(language,es,en);
  const [billing,setBilling]=useState('monthly'),[plan,setPlan]=useState('');
  const [preferredBilling,setPreferredBilling]=useState('');
  const money=new Intl.NumberFormat(language==='en'?'en-US':'es-CR');
  return <>
    <header className="top"><div className="wrap top-inner"><Brand language={language}/>
      <nav aria-label={l('Principal','Main')}><a href="#funciones">{l('Funciones','Features')}</a><a href="#planes">{l('Planes','Plans')}</a><a href="#demos">{l('Demos','Demos')}</a></nav>
      <div className="line"><button className="lang" aria-label={l('Cambiar a inglés','Switch to Spanish')}
        onClick={()=>setLanguage(language==='es'?'en':'es')}>{language==='es'?'EN':'ES'}</button>
        <a className="primary top-cta" href="#solicitar">{l('Solicitar información','Request information')}</a></div></div></header>
    <main>
      <section className="hero"><div className="wrap hero-grid"><div className="hero-copy">
        <p className="eyebrow">{l('Para empresas de seguridad y operación por turnos','For security and shift-based operations')}</p>
        <h1>{l('Tu operación,','Your operation,')}<br/><em>{l('puesto a puesto.','post by post.')}</em></h1>
        <p className="hero-text">{l('Coordina turnos, documenta la asistencia y revisa la planilla desde un solo sistema. El personal opera desde Android y Monitoreo sigue cada puesto desde el panel web.',
          'Coordinate shifts, record attendance and review payroll in one system. Staff work from Android while Monitoring follows every post in the web dashboard.')}</p>
        <div className="line"><a className="primary" href="#solicitar">{l('Solicitar información','Request information')}</a>
          <a className="secondary-link" href="#planes">{l('Ver planes','See plans')} <span aria-hidden="true">↘</span></a></div>
      </div><WorkflowVisual language={language}/></div></section>
      <section id="funciones" className="slice features"><div className="wrap">
        <div className="heading"><p className="eyebrow">{l('Operación diaria','Daily operations')}</p>
          <h2>{l('Del puesto a la planilla','From security post to payroll')}</h2></div>
        <div className="feature-grid">
          {[
            ['◴','Turnos y asistencia','Shifts and attendance','Programa turnos, registra entradas y salidas y conserva la evidencia del relevo.','Schedule shifts, record attendance and keep evidence of handovers.'],
            ['◇','Rondas y supervisión','Patrols and supervision','Configura puntos de ronda con QR y revisa desde Monitoreo las marcas e incidencias.','Set up QR checkpoints and review patrol scans and incidents from Monitoring.'],
            ['▤','Planilla y exportación','Payroll and exports','Revisa horas ordinarias, extras y feriados. Exporta la quincena a Excel o CSV.','Review ordinary, overtime and holiday hours. Export pay periods to Excel or CSV.'],
          ].map(([icon,title,en,description,descEn])=><article key={title}><span aria-hidden="true">{icon}</span><h3>{l(title,en)}</h3><p>{l(description,descEn)}</p></article>)}
        </div>
      </div></section>
      <section className="slice pricing" id="planes"><div className="wrap"><div className="heading pricing-head">
        <div><p className="eyebrow">{l('Precios en USD','Pricing in USD')}</p><h2>{l('Planes por tamaño de empresa','Plans by company size')}</h2></div>
        <div className="toggle"><button aria-pressed={billing==='monthly'} onClick={()=>setBilling('monthly')}>{l('Mensual','Monthly')}</button>
          <button aria-pressed={billing==='annual'} onClick={()=>setBilling('annual')}>{l('Anual','Annual')}</button></div>
      </div><div className="plan-grid">
        {plans.map(row=><article key={row.id} className={row.quoteOnly?'quote-plan':undefined}>
          <h3>{l(row.es,row.en)}</h3>
          {row.quoteOnly?
            <p className="billing-note">{l('Cuéntanos cómo opera tu empresa para preparar una cotización.','Tell us how your company operates so we can prepare a quote.')}</p>:
            <><p className="price"><span>USD</span> {money.format(row[billing])}</p>
              <p className="billing-note">{billing==='monthly'?l('Por mes, por adelantado','Per month, billed in advance'):l('Por año, pago completo','Per year, paid in full')}</p></>}
          <a className="outline" href="#solicitar" onClick={()=>{setPlan(row.id);setPreferredBilling(row.quoteOnly?'':billing);}}>
            {row.quoteOnly?l('Solicitar cotización','Request a quote'):l('Solicitar información','Request information')}
          </a>
        </article>)}
      </div></div></section>
      <DemoSection language={language}/><LeadForm language={language} plan={plan} setPlan={setPlan}
        preferredBilling={preferredBilling} setPreferredBilling={setPreferredBilling}/>
    </main>
    <footer><div className="wrap footer"><Brand language={language}/></div></footer>
  </>;
}

function App(){
  const [language,setLanguage]=useState(localStorage.getItem('centinela-web-language')==='en'?'en':'es');
  useEffect(()=>{document.documentElement.lang=language;localStorage.setItem('centinela-web-language',language);},[language]);
  return window.location.pathname.startsWith('/admin')?<Admin language={language} setLanguage={setLanguage}/>:<Home language={language} setLanguage={setLanguage}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
