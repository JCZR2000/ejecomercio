        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('Service Worker registrado: ', reg.scope))
                    .catch(err => console.log('Service Worker falló: ', err));
            });
        }
