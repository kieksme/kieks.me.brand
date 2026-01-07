// Import CSS for Vite processing
import './styles.css';

// Initialize Datadog RUM
import './datadog-rum.js';

// Header shadow and transparency scroll behavior
function initHeaderShadow() {
    const nav = document.querySelector('nav.bg-navy.sticky');
    if (!nav) return;

    // Remove shadow-lg from initial classes if present
    nav.classList.remove('shadow-lg');

    function updateHeader() {
        if (window.scrollY > 0) {
            nav.classList.add('shadow-lg');
            nav.classList.remove('header-transparent');
        } else {
            nav.classList.remove('shadow-lg');
            nav.classList.add('header-transparent');
        }
    }

    // Check initial scroll position
    updateHeader();

    // Update on scroll with throttling for better performance
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateHeader();
                ticking = false;
            });
            ticking = true;
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderShadow);
} else {
    initHeaderShadow();
}
