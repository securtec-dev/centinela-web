export async function call(path, language, options = {}) {
  const { method = 'GET', data } = options;
  const response = await fetch('/api/' + path, {
    method, credentials: 'same-origin',
    headers: { Accept:'application/json', 'Accept-Language':language, ...(data ? { 'Content-Type':'application/json' }: {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error((language==='en'&&result.message_en)||result.message||
    (language==='en'?'The request could not be completed.':'La solicitud no pudo completarse.')), {status:response.status});
  return result;
}

export const plans = [
  { id:'team', es:'De 1 a 99 personas', en:'1–99 people', monthly:70, annual:770 },
  { id:'100', es:'De 100 a 200 personas', en:'100–200 people', monthly:100, annual:1100 },
  { id:'500', es:'De 201 a 500 personas', en:'201–500 people', monthly:450, annual:5100 },
  { id:'1000', es:'De 501 a 1.000 personas', en:'501–1,000 people', monthly:850, annual:10000 },
];

export const billingOptions = { monthly: ['Mensual', 'Monthly'], annual: ['Anual', 'Annual'] };

export const t=(language,es,en)=>language==='en'?en:es;
