if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller; // false en la primera instalación: ahí no hay nada que avisar
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                // La app instalada puede pasar días abierta sin navegar: al volver a ella se busca versión nueva
                document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
            })
            .catch(err => console.log('Service Worker falló: ', err));
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) document.getElementById('updateBanner')?.classList.remove('hidden');
    });
}
