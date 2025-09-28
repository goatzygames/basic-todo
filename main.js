// Lightweight interactions and polish for the site
document.addEventListener('DOMContentLoaded',()=>{
// set year across pages
const y = new Date().getFullYear();
document.querySelectorAll('#year, #year-about, #year-projects, #year-sample, #year-contact').forEach(el=>{ if(el) el.textContent = y });


// mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.querySelector('.main-nav');
if(navToggle){
navToggle.addEventListener('click',()=>{
if(mainNav.style.display==='flex') mainNav.style.display=''; else mainNav.style.display='flex';
mainNav.style.flexDirection='column';
})
}


// subtle entrance animations
document.querySelectorAll('.container > h2, .lead, .feature, .project-card, .hero-card, .mockup').forEach((el,i)=>{
el.style.opacity=0; el.style.transform='translateY(12px)';
setTimeout(()=>{ el.style.transition='opacity 520ms ease, transform 520ms cubic-bezier(.2,.9,.2,1)'; el.style.opacity=1; el.style.transform='translateY(0)'; }, 160 + i*80)
})


// floating mockup effect on hover
const mockup = document.querySelector('.mockup');
if(mockup){
mockup.addEventListener('mousemove', (e)=>{
const rX = (e.offsetY - mockup.clientHeight/2) / 20;
const rY = (e.offsetX - mockup.clientWidth/2) / 20;
mockup.style.transform = `rotateX(${rX}deg) rotateY(${-rY}deg) scale(1.02)`;
})
mockup.addEventListener('mouseleave', ()=>{ mockup.style.transform='none' })
}


// form handlers (demo only)
window.subscribe = function(e){
e.preventDefault();
const email = document.getElementById('email');
if(!email.value) return alert('Please enter email');
email.value='';
alert('Thanks! (This is a demo subscribe handler)')
return false;
}

window.contactSubmit = function(e){
e.preventDefault();
const name = document.getElementById('c-name').value.trim();
const email = document.getElementById('c-email').value.trim();
const msg = document.getElementById('c-message').value.trim();
if(!name||!email||!msg) return alert('Please fill all fields');
alert('Message sent! (demo)');
document.getElementById('c-name').value=''; document.getElementById('c-email').value=''; document.getElementById('c-message').value='';
return false;
}
});

const mainImages = document.querySelectorAll('.gallery-main img');
const thumbs = document.querySelectorAll('.gallery-thumbs .thumb');

thumbs.forEach((thumb, index) => {
  thumb.addEventListener('click', () => {
    // Switch main image
    mainImages.forEach(img => img.classList.remove('active'));
    mainImages[index].classList.add('active');

    // Update active thumbnail
    thumbs.forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
  });
});
