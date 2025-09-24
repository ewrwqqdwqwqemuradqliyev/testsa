document.addEventListener("DOMContentLoaded",()=>{

    const myAdsContainer=document.getElementById('myAds');
    if(myAdsContainer){
        fetch('/myAds').then(r=>r.json()).then(data=>{
            myAdsContainer.innerHTML='';
            data.forEach(ad=>{
                const card=document.createElement('div');
                card.className='ad-card';
                card.innerHTML=`
                    ${ad.image?`<img src="/uploads/${ad.image}">`:''}
                    <div class="content">
                        <h3>${ad.title}</h3>
                        <p>${ad.description.substring(0,80)}...</p>
                        <small>Kateqoriya: ${ad.category}</small>
                        <br><a href="/editAd/${ad.id}">Düzəliş et</a>
                    </div>
                `;
                myAdsContainer.appendChild(card);
            });
        });
    }

    const accContainer=document.getElementById('accountInfo');
    if(accContainer){
        fetch('/userInfo').then(r=>r.json()).then(data=>{
            accContainer.innerHTML=`
                <p><b>Ad:</b> ${data.username}</p>
                <p><b>Email:</b> ${data.email}</p>
            `;
        });
    }

});
