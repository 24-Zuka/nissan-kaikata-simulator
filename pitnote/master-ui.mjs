import {MASTER_STATUS} from './private-master.mjs';
export function mountMaster(){
 document.querySelectorAll('.master-strip').forEach(node=>node.remove());
 const strip=document.querySelector('.storage-strip');
 const box=document.createElement('div');box.className='master-strip';
 const text=document.createElement('span');
 text.textContent=MASTER_STATUS+'。改定資料を渡してアプリを更新する運用です。適用時期・条件は各資料の記載に従います。';
 box.append(text);strip?.after(box);
}
