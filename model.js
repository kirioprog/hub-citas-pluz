/* Datos ficticios; el estado vive únicamente en memoria durante esta sesión. */
(() => {
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const statuses=['Pendiente de contacto','Franja ofrecida','Confirmada','Recordada','En camino','Realizada','Reprogramada','Cancelada','Cliente ausente'];
const rows=[
['1041','Carlos Mendoza','912 345 601','Santa Anita','Av. Los Eucaliptos 245', 'Franja ofrecida','A',null,0,-2,2,true,'08:00–10:00'],
['1042','Lucía Ramírez','923 456 602','Ate','Jr. Las Orquídeas 118','Confirmada','A','1',0,-1,1,true,'08:00–10:00'],
['1043','Valeria Torres','934 567 603','La Molina','Calle Los Olivos 362','En camino','B','2',0,-2,1,true,'10:00–12:00'],
['1044','Diego Salazar','945 678 604','Santa Anita','Av. Los Nogales 507','Pendiente de contacto','A',null,0,-2,2,false,'10:00–12:00'],
['1045','Mariana Flores','956 789 605','Ate','Calle Las Palmeras 82','Realizada','A','1',0,-1,1,true,'12:00–14:00'],
['1046','Gabriel Paredes','967 890 606','La Molina','Jr. Los Cedros 194','Reprogramada','B','3',1,-1,1,true,'08:00–10:00'],
['1047','Camila Rojas','978 901 607','Santa Anita','Calle Los Sauces 46','Cancelada','B',null,0,-1,1,true,'14:00–16:00'],
['1048','Mateo Vega','989 012 608','Ate','Av. Las Magnolias 280','Cliente ausente','A','2',0,-2,1,true,'14:00–16:00']
];
function slots(date){const day=new Date(date+'T12:00:00').getDay();return day===0?[]:day===6?['08:00–10:00','10:00–12:00','12:00–14:00']:['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00','16:00–18:00']}
let base=today; if(!slots(base).length)base=addDays(base,1);
const appointments=rows.map((r,i)=>{const date=addDays(base,r[8]); const requested=addDays(base,r[9]); const status=r[5];const history=[{text:'Solicitud registrada',at:requested+'T08:00:00'}];if(status!=='Pendiente de contacto')history.push({text:'WhatsApp enviado · franja ofrecida',at:requested+'T09:15:00'});if(['Confirmada','En camino','Realizada','Cliente ausente'].includes(status))history.push({text:'Cliente confirmó la visita',at:requested+'T10:30:00'});if(['En camino','Realizada','Cliente ausente'].includes(status))history.push({text:'Recordatorio de visita enviado',at:date+'T07:00:00'},{text:'Técnico en camino',at:date+'T08:10:00'});if(['Realizada','Cliente ausente','Cancelada','Reprogramada'].includes(status))history.push({text:status==='Realizada'?'Resultado: cliente presente':status==='Cliente ausente'?'Resultado: cliente ausente':status==='Cancelada'?'Cliente canceló la visita':'Cliente solicitó reprogramación',at:date+'T09:00:00'});return {id:'FT-2026-'+r[0],name:r[1],phone:r[2],zone:r[3],address:r[4],status,contractor:r[6],crew:r[7],date,requested,attempts:r[10],addressValid:r[11],slot:slots(date).includes(r[12])?r[12]:(slots(date)[0]||r[12]),dni:'0000'+String(1000+i),history,representative:null,comment:''}});
const changes=[{id:'seed1',appointment:appointments[2].id,text:'El técnico inició su recorrido',at:new Date().toISOString(),fresh:false},{id:'seed2',appointment:appointments[1].id,text:'Cliente confirmó su franja',at:new Date().toISOString(),fresh:false},{id:'seed3',appointment:appointments[5].id,text:'Cliente solicitó reprogramación',at:new Date().toISOString(),fresh:false}];
const closed=a=>['Realizada','Cancelada','Cliente ausente'].includes(a.status);
const remaining=a=>Math.round((new Date(addDays(a.requested,3)+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);
const risk=a=>!closed(a)&&remaining(a)<=1;
function event(a,text,status){if(status)a.status=status;const at=new Date().toISOString();a.history.push({text,at});changes.unshift({id:'change'+Date.now()+Math.random(),appointment:a.id,text,at,fresh:true})}
function schedule(a,date,slot){if(date<today)throw new Error('Elige hoy o una fecha futura.');if(date>addDays(a.requested,3))throw new Error('La visita debe ocurrir dentro de los 3 días de la solicitud.');if(!slots(date).includes(slot))throw new Error('Elige una franja válida. De lunes a viernes: 08:00–18:00. Sábado: 08:00–14:00.');a.date=date;a.slot=slot;event(a,'Visita reprogramada para '+date+' · '+slot,'Reprogramada')}
window.Hub={today,base,addDays,slots,statuses,appointments,changes,closed,remaining,risk,event,schedule};
})();
