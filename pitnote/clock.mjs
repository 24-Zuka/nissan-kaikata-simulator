// Device clock, interpreted in Japan. The argument makes timezone boundaries testable.
export function japanToday(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
export const adoptionMonth=today=>today.slice(0,7);
