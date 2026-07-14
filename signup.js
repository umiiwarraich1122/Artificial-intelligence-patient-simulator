import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
    "https://lwpblqvieqvfkvrbvtwi.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGJscXZpZXF2Zmt2cmJ2dHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTQwMDUsImV4cCI6MjA5OTIzMDAwNX0.gTgjavi7n_LuP7bFvDDMoOcwCiYNReAET9IOZMc_8jg"
);

let isSignUpMode = false;

// Theme switching management logic
function toggleTheme() {
    document.body.classList.toggle("light-theme");
    const themeIcon = document.getElementById("themeIcon");
    const isLight = document.body.classList.contains("light-theme");
    
    if (isLight) {
        themeIcon.className = "fa-solid fa-moon";
        localStorage.setItem("theme", "light");
    } else {
        themeIcon.className = "fa-solid fa-sun";
        localStorage.setItem("theme", "dark");
    }
}

function restoreTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        document.getElementById("themeIcon").className = "fa-solid fa-moon";
    }
}

// Session check immediately before rendering content to prevent flashing
async function runSessionCheck() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        if (window.location.port === "5500" || window.location.pathname.includes("signup.html")) {
            window.location.replace("index.html");
        } else {
            window.location.replace("/chat");
        }
    } else {
        document.body.style.display = "flex";
    }
}

// Toggles local form state between login and registration
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    
    const formTitle = document.getElementById("formTitle");
    const formSubtitle = document.getElementById("formSubtitle");
    const btnText = document.getElementById("btnText");
    const toggleTextLabel = document.getElementById("toggleTextLabel");
    const toggleBtn = document.getElementById("toggleBtn");

    const groupFullName = document.getElementById("groupFullName");
    const groupConfirmPassword = document.getElementById("groupConfirmPassword");
    const groupRole = document.getElementById("groupRole");
    const alertBox = document.getElementById("alertBox");

    alertBox.style.display = "none";

    if (isSignUpMode) {
        formTitle.textContent = "Create Account";
        formSubtitle.textContent = "Sign up for clinical simulation laboratory training";
        btnText.textContent = "Create Account";
        toggleTextLabel.textContent = "Already registered?";
        toggleBtn.textContent = "Sign In";
        
        groupFullName.style.display = "block";
        groupConfirmPassword.style.display = "block";
        groupRole.style.display = "block";
        
        document.getElementById("inputFullName").required = true;
        document.getElementById("inputConfirmPassword").required = true;
    } else {
        formTitle.textContent = "Welcome Back";
        formSubtitle.textContent = "Sign in to resume simulation training sessions";
        btnText.textContent = "Sign In";
        toggleTextLabel.textContent = "New to simulator?";
        toggleBtn.textContent = "Sign Up";
        
        groupFullName.style.display = "none";
        groupConfirmPassword.style.display = "none";
        groupRole.style.display = "none";

        document.getElementById("inputFullName").required = false;
        document.getElementById("inputConfirmPassword").required = false;
    }
}

// Form handler logic supporting email/password sign-in and sign-up
async function handleFormSubmit(e) {
    e.preventDefault();
    const alertBox = document.getElementById("alertBox");
    alertBox.style.display = "none";

    const email = document.getElementById("inputEmail").value.trim();
    const password = document.getElementById("inputPassword").value;

    if (isSignUpMode) {
        const fullName = document.getElementById("inputFullName").value.trim();
        const confirmPassword = document.getElementById("inputConfirmPassword").value;
        const role = document.getElementById("inputRole").value;

        if (password !== confirmPassword) {
            showAlert("Passwords do not match.");
            return;
        }

        setLoadingState(true);
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                }
            }
        });
        setLoadingState(false);

        if (error) {
            showAlert(error.message);
        } else {
            showAlert("Account created! Please check your email for confirmation or sign in.", false);
            toggleAuthMode();
        }
    } else {
        setLoadingState(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        setLoadingState(false);

        if (error) {
            showAlert(error.message);
        } else if (data.session) {
            // ⚠️ FIX: Delay redirection by 150ms to ensure localStorage completes writes
            setTimeout(() => {
                if (window.location.port === "5500" || window.location.pathname.includes("signup.html")) {
                    window.location.replace("index.html");
                } else {
                    window.location.replace("/chat");
                }
            }, 150);
        }
    }
}

// Loading indicators
function setLoadingState(isLoading) {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = isLoading;
    submitBtn.style.opacity = isLoading ? "0.7" : "1";
}

// Inline alert display
function showAlert(message, isError = true) {
    const alertBox = document.getElementById("alertBox");
    alertBox.textContent = message;
    alertBox.style.display = "block";
    alertBox.style.backgroundColor = isError ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)";
    alertBox.style.borderColor = isError ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)";
    alertBox.style.color = isError ? "#fca5a5" : "#a7f3d0";
}

// Trigger Google OAuth Flow directly to index.html/chat page
async function loginGoogle() {
    let redirectUrl = `${window.location.origin}/chat`;
    if (window.location.port === "5500" || window.location.pathname.includes("signup.html")) {
        redirectUrl = `${window.location.origin}/index.html`;
    }
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: redirectUrl
        }
    });
    if (error) {
        showAlert(error.message);
    }
}

// Parse token and handles callback redirection if land on /auth/callback
async function handleAuthCallback() {
    if (window.location.pathname !== "/auth/callback") {
        return;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error(error);
            return;
        }
        if (session) {
            // ⚠️ FIX: Delay redirection by 150ms to ensure token persistence completes
            setTimeout(() => {
                if (window.location.port === "5500" || window.location.pathname.includes("signup.html")) {
                    window.location.replace("index.html");
                } else {
                    window.location.replace("/chat");
                }
            }, 150);
        }
    } catch (err) {
        console.error(err);
    }
}

// Bind global click actions
window.toggleAuthMode = toggleAuthMode;
window.toggleTheme = toggleTheme;
document.getElementById("authForm").addEventListener("submit", handleFormSubmit);
document.getElementById("googleBtn").addEventListener("click", loginGoogle);

// Run bootstrap auth checks
restoreTheme();
await runSessionCheck();
await handleAuthCallback();
