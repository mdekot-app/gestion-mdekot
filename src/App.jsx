import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  writeBatch,
  setDoc,
  where,
  orderBy,
  getDocs,
  limit,
  runTransaction
} from "firebase/firestore";
import { auth, db, getFirebaseMessaging, VAPID_KEY } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser
} from "firebase/auth";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const SUPERS = [
  { key: "MERCADONA", defaultName: "MERCADONA" },
  { key: "LIDL", defaultName: "LIDL" },
  { key: "ALCAMPO", defaultName: "ALCAMPO" },
  { key: "CARREFOUR", defaultName: "CARREFOUR" }
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function App() {
  const [usuarioAuth, setUsuarioAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerGroupName, setRegisterGroupName] = useState("");
  const [registerGender, setRegisterGender] = useState("hombre");
  const [inviteCode, setInviteCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authBootstrapActive, setAuthBootstrapActive] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [groupProfile, setGroupProfile] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);

  const [vista, setVista] = useState("dashboard");
  const [balance, setBalance] = useState(0);
  const [importe, setImporte] = useState("");
  const [pagadoPor, setPagadoPor] = useState("");
  const [comercio, setComercio] = useState("");
  const [gastos, setGastos] = useState([]);

  const [mesActual, setMesActual] = useState(new Date().getMonth() + 1);
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());

  const [gastoEditando, setGastoEditando] = useState(null);
  const [editComercio, setEditComercio] = useState("");
  const [editImporte, setEditImporte] = useState("");
  const [editPagadoPor, setEditPagadoPor] = useState("");
  const [gastoAEliminar, setGastoAEliminar] = useState(null);

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [superMobile, setSuperMobile] = useState("MERCADONA");

  const [notificacionesActivas, setNotificacionesActivas] = useState(
    localStorage.getItem("notificationsEnabled") !== "false"
  );
  const [pushReady, setPushReady] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [productos, setProductos] = useState([]);

  const [inputsSuper, setInputsSuper] = useState({
    MERCADONA: "",
    LIDL: "",
    ALCAMPO: "",
    CARREFOUR: ""
  });

  const [productoEditando, setProductoEditando] = useState(null);
  const [editProductoNombre, setEditProductoNombre] = useState("");
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  const [limpiarCompradosConfirm, setLimpiarCompradosConfirm] = useState({
    open: false,
    superKey: null
  });

  const [nombresSupers, setNombresSupers] = useState({
    MERCADONA: "MERCADONA",
    LIDL: "LIDL",
    ALCAMPO: "ALCAMPO",
    CARREFOUR: "CARREFOUR"
  });

  const [superEditando, setSuperEditando] = useState(null);
  const [editSuperNombre, setEditSuperNombre] = useState("");

  const [liquidarConfirmOpen, setLiquidarConfirmOpen] = useState(false);
  const [estadoDeuda, setEstadoDeuda] = useState(null);
  const [liquidacionGuardada, setLiquidacionGuardada] = useState(null);

  const hoy = new Date();
  const [calMes, setCalMes] = useState(hoy.getMonth() + 1);
  const [calAnio, setCalAnio] = useState(hoy.getFullYear());
  const [eventos, setEventos] = useState([]);

  const [eventoNuevoOpen, setEventoNuevoOpen] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [eventoAEliminar, setEventoAEliminar] = useState(null);

  const [evTitulo, setEvTitulo] = useState("");
  const [evTipo, setEvTipo] = useState("OTRO");
  const [evFecha, setEvFecha] = useState("");
  const [evHora, setEvHora] = useState("00:00");
  const [evNotas, setEvNotas] = useState("");

  const [diaDetalleOpen, setDiaDetalleOpen] = useState(false);
  const [diaDetalleFecha, setDiaDetalleFecha] = useState("");

  const grupoId = userProfile?.grupoId || null;

  const esDispositivoMovilReal = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  };

  const getPlatform = () => (esDispositivoMovilReal() ? "mobile" : "pc");

  const normalizarCodigoInvitacion = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .trim();

  const generarCodigoBase = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  };

  const generarCodigoInvitacionUnico = async () => {
    for (let i = 0; i < 10; i++) {
      const code = generarCodigoBase();
      const q = query(collection(db, "grupos"), where("codigoInvitacion", "==", code), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return code;
    }
    throw new Error("No se pudo generar un código único");
  };

  const limpiarFormularioAuth = () => {
    setLoginEmail("");
    setLoginPassword("");
    setRegisterName("");
    setRegisterGroupName("");
    setRegisterGender("hombre");
    setInviteCode("");
    setLoginError("");
  };

  const getNombreUsuarioPorEmail = (email) => {
    const miembro = groupMembers.find((m) => m.email === email);
    if (miembro?.nombre) return miembro.nombre;
    if (userProfile?.email === email) return userProfile?.nombre || email;
    return email || "Usuario";
  };

  const getGeneroPorEmail = (email) => {
    const miembro = groupMembers.find((m) => m.email === email);
    if (miembro?.sexo) return miembro.sexo;
    if (userProfile?.email === email) return userProfile?.sexo || "hombre";
    return "hombre";
  };

  const getBadgeStyleByGender = (sexo) => (sexo === "mujer" ? styles.payJessica : styles.payMirko);
  const getBadgeIconByGender = (sexo) => (sexo === "mujer" ? "👩" : "👨");

  const participantesGrupo = useMemo(() => {
    const miembrosValidos = groupMembers
      .filter((m) => m?.email)
      .map((m) => ({
        uid: m.id,
        nombre: m.nombre || m.email,
        email: m.email,
        sexo: m.sexo || "hombre"
      }));

    if (miembrosValidos.length > 0) return miembrosValidos.slice(0, 2);

    if (userProfile?.email) {
      return [
        {
          uid: userProfile.id || usuarioAuth?.uid || "self",
          nombre: userProfile.nombre || userProfile.email,
          email: userProfile.email,
          sexo: userProfile.sexo || "hombre"
        }
      ];
    }

    return [];
  }, [groupMembers, userProfile, usuarioAuth]);

  const participanteA = participantesGrupo[0] || null;
  const participanteB = participantesGrupo[1] || null;

  useEffect(() => {
    const emailsValidos = participantesGrupo.map((p) => p.email).filter(Boolean);

    if (emailsValidos.length === 0) {
      setPagadoPor("");
      return;
    }

    if (!pagadoPor || !emailsValidos.includes(pagadoPor)) {
      setPagadoPor(emailsValidos[0]);
    }
  }, [participantesGrupo, pagadoPor]);

  const iniciarSesion = async () => {
    try {
      setAuthBusy(true);
      setLoginError("");
      setAuthBootstrapActive(false);
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
    } catch (e) {
      console.error(e);
      setLoginError("Email o contraseña incorrectos");
    } finally {
      setAuthBusy(false);
    }
  };

  const crearCuentaYGrupo = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Completa email y contraseña");
      return;
    }

    if (!registerGroupName.trim()) {
      setLoginError("Pon un nombre al grupo");
      return;
    }

    try {
      setAuthBusy(true);
      setLoginError("");
      setAuthBootstrapActive(true);

      const emailNormalizado = loginEmail.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, emailNormalizado, loginPassword);
      const uid = userCredential.user.uid;

      const codigoInvitacion = await generarCodigoInvitacionUnico();
      const grupoRef = doc(collection(db, "grupos"));
      const nombreUsuario = (registerName || "").trim() || emailNormalizado.split("@")[0];

      await setDoc(grupoRef, {
        nombre: registerGroupName.trim(),
        codigoInvitacion,
        createdAt: new Date(),
        createdBy: uid,
        miembrosCount: 1,
        maxMiembros: 2,
        miembros: [uid]
      });

      const perfilNuevo = {
        nombre: nombreUsuario,
        sexo: registerGender,
        email: emailNormalizado,
        grupoId: grupoRef.id,
        grupoCodigo: codigoInvitacion,
        grupoNombre: registerGroupName.trim(),
        createdAt: new Date()
      };

      await setDoc(doc(db, "usuarios", uid), perfilNuevo);

      limpiarFormularioAuth();
    } catch (e) {
      console.error(e);
      setAuthBootstrapActive(false);
      if (e.code === "auth/email-already-in-use") setLoginError("Ese email ya está registrado");
      else if (e.code === "auth/weak-password") setLoginError("La contraseña debe tener al menos 6 caracteres");
      else setLoginError("No se pudo crear la cuenta");
    } finally {
      setAuthBusy(false);
    }
  };

  const crearCuentaYUnirseAGrupo = async () => {
    const codigo = normalizarCodigoInvitacion(inviteCode);

    if (!loginEmail.trim() || !loginPassword.trim() || !codigo) {
      setLoginError("Completa email, contraseña y código");
      return;
    }

    let userCredential = null;

    try {
      setAuthBusy(true);
      setLoginError("");
      setAuthBootstrapActive(true);

      const emailNormalizado = loginEmail.trim().toLowerCase();
      userCredential = await createUserWithEmailAndPassword(auth, emailNormalizado, loginPassword);
      const uid = userCredential.user.uid;
      const nombreUsuario = (registerName || "").trim() || emailNormalizado.split("@")[0];

      const q = query(collection(db, "grupos"), where("codigoInvitacion", "==", codigo), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("Ese código no existe");
      }

      const grupoDoc = snap.docs[0];
      const grupoRef = doc(db, "grupos", grupoDoc.id);
      let perfilNuevo = null;

      await runTransaction(db, async (transaction) => {
        const grupoSnap = await transaction.get(grupoRef);

        if (!grupoSnap.exists()) throw new Error("El grupo ya no existe");

        const data = grupoSnap.data() || {};
        const miembros = Array.isArray(data.miembros) ? data.miembros : [];
        const miembrosCount = Number(data.miembrosCount || miembros.length || 0);
        const maxMiembros = Number(data.maxMiembros || 2);

        if (miembrosCount >= maxMiembros) throw new Error("Este grupo ya tiene 2 personas");

        const nuevosMiembros = miembros.includes(uid) ? miembros : [...miembros, uid];

        transaction.update(grupoRef, {
          miembrosCount: Math.min(miembrosCount + 1, 2),
          miembros: nuevosMiembros,
          updatedAt: new Date()
        });

        perfilNuevo = {
          nombre: nombreUsuario,
          sexo: registerGender,
          email: emailNormalizado,
          grupoId: grupoRef.id,
          grupoCodigo: data.codigoInvitacion || codigo,
          grupoNombre: data.nombre || "Grupo",
          createdAt: new Date()
        };

        transaction.set(doc(db, "usuarios", uid), perfilNuevo);
      });

      limpiarFormularioAuth();
    } catch (e) {
      console.error(e);

      if (userCredential?.user) {
        try {
          await deleteUser(userCredential.user);
        } catch (cleanupError) {
          console.error("No se pudo limpiar el usuario creado tras error:", cleanupError);
        }
      }

      setAuthBootstrapActive(false);

      if (e.code === "auth/email-already-in-use") setLoginError("Ese email ya está registrado");
      else if (e.code === "auth/weak-password") setLoginError("La contraseña debe tener al menos 6 caracteres");
      else if (String(e.message || "").includes("2 personas")) setLoginError("Ese grupo ya tiene 2 personas");
      else if (String(e.message || "").includes("no existe")) setLoginError("Ese código no existe");
      else setLoginError("No se pudo unir al grupo");
    } finally {
      setAuthBusy(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      setMenuAbierto(false);
      setAuthBootstrapActive(false);
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  const guardarTokenEnFirestore = async (token, enabled, extra = {}) => {
    if (!token) return;

    await setDoc(
      doc(db, "pushTokens", token),
      {
        token,
        uid: extra.uid || "",
        email: extra.email || "",
        nombre: extra.nombre || "",
        grupoId: extra.grupoId || "",
        grupoNombre: extra.grupoNombre || "",
        createdAt: new Date(),
        updatedAt: new Date(),
        userAgent: navigator.userAgent || "",
        platform: getPlatform(),
        notificationsEnabled: enabled
      },
      { merge: true }
    );
  };

  const registrarPushSilencioso = async () => {
    try {
      if (!("Notification" in window)) return false;
      if (Notification.permission !== "granted") return false;

      const vapid = String(VAPID_KEY || "").trim();
      if (!vapid) return false;
      if (!("serviceWorker" in navigator)) return false;

      const swReg =
        (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
        (await navigator.serviceWorker.ready);

      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const token = await getToken(messaging, {
        vapidKey: vapid,
        serviceWorkerRegistration: swReg
      });

      if (!token) return false;

      localStorage.setItem("fcmToken", token);
      await guardarTokenEnFirestore(token, localStorage.getItem("notificationsEnabled") !== "false", {
        uid: usuarioAuth?.uid || "",
        email: userProfile?.email || usuarioAuth?.email || "",
        nombre: userProfile?.nombre || "",
        grupoId: grupoId || "",
        grupoNombre: groupProfile?.nombre || userProfile?.grupoNombre || ""
      });
      setPushReady(true);
      return true;
    } catch (e) {
      console.error("❌ registrarPushSilencioso:", e);
      return false;
    }
  };

  const activarNotificacionesSilencioso = async () => {
    try {
      if (!("Notification" in window)) return false;

      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return false;
      }

      if (Notification.permission !== "granted") return false;

      const ok = await registrarPushSilencioso();
      if (!ok) return false;

      localStorage.setItem("notificationsEnabled", "true");
      setNotificacionesActivas(true);

      const token = localStorage.getItem("fcmToken");
      if (token) {
        await guardarTokenEnFirestore(token, true, {
          uid: usuarioAuth?.uid || "",
          email: userProfile?.email || usuarioAuth?.email || "",
          nombre: userProfile?.nombre || "",
          grupoId: grupoId || "",
          grupoNombre: groupProfile?.nombre || userProfile?.grupoNombre || ""
        });
      }

      return true;
    } catch (e) {
      console.error("❌ activarNotificacionesSilencioso:", e);
      return false;
    }
  };

  const toggleNotificaciones = async () => {
    try {
      const siguiente = !notificacionesActivas;
      const token = localStorage.getItem("fcmToken");

      if (siguiente) {
        const ok = await activarNotificacionesSilencioso();
        if (!ok) return;
        setNotificacionesActivas(true);
        return;
      }

      localStorage.setItem("notificationsEnabled", "false");
      setNotificacionesActivas(false);

      if (token) {
        await guardarTokenEnFirestore(token, false, {
          uid: usuarioAuth?.uid || "",
          email: userProfile?.email || usuarioAuth?.email || "",
          nombre: userProfile?.nombre || "",
          grupoId: grupoId || "",
          grupoNombre: groupProfile?.nombre || userProfile?.grupoNombre || ""
        });
      }
    } catch (e) {
      console.error("❌ toggleNotificaciones:", e);
    }
  };

  const enviarPushAGrupoActual = async ({ title, body, link }) => {
    try {
      if (!grupoId) return { ok: false, error: "Sin grupoId" };
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return { ok: false, error: "Sesion no valida" };

      const res = await fetch("/api/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ title, body, link, grupoId })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) return { ok: false, data };
      return { ok: true, data };
    } catch (e) {
      console.warn("❌ Error enviando push:", e);
      return { ok: false, error: e };
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUsuarioAuth(user || null);
      if (!user) {
        setUserProfile(null);
        setGroupProfile(null);
        setGroupMembers([]);
        setAuthBootstrapActive(false);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!usuarioAuth?.uid) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const ref = doc(db, "usuarios", usuarioAuth.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...snap.data() });
        } else {
          setUserProfile(null);
        }
        setAuthBootstrapActive(false);
        setProfileLoading(false);
      },
      (e) => {
        console.error("Error cargando perfil de usuario:", e);
        setUserProfile(null);
        setProfileLoading(false);
      }
    );

    return () => unsub();
  }, [usuarioAuth?.uid]);

  useEffect(() => {
    if (!grupoId) {
      setGroupProfile(null);
      return;
    }

    const ref = doc(db, "grupos", grupoId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setGroupProfile({ id: snap.id, ...snap.data() });
        else setGroupProfile(null);
      },
      (e) => {
        console.error("Error cargando grupo:", e);
        setGroupProfile(null);
      }
    );

    return () => unsub();
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId) {
      setGroupMembers([]);
      return;
    }

    const qUsuariosGrupo = query(collection(db, "usuarios"), where("grupoId", "==", grupoId));
    const unsub = onSnapshot(
      qUsuariosGrupo,
      (snapshot) => {
        const usuariosGrupo = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        usuariosGrupo.sort((a, b) => {
          const fa = a.createdAt?.seconds || 0;
          const fb = b.createdAt?.seconds || 0;
          return fa - fb;
        });

        setGroupMembers(usuariosGrupo);
      },
      (e) => {
        console.error("Error cargando miembros del grupo:", e);
        setGroupMembers([]);
      }
    );

    return () => unsub();
  }, [grupoId]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    const init = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      } catch (e) {
        console.error("❌ SW register error:", e);
      }

      const ok = await registrarPushSilencioso();
      if (ok) setPushReady(true);
    };

    init();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    const initForegroundListener = async () => {
      try {
        const messaging = await getFirebaseMessaging();
        if (!messaging) return;

        unsubscribe = onMessage(messaging, async (payload) => {
          try {
            const activadas = localStorage.getItem("notificationsEnabled") !== "false";
            if (!activadas) return;
            if (Notification.permission !== "granted") return;

            const title = payload?.data?.title || "Gestión Mdekot";
            const body = payload?.data?.body || "";
            const link = payload?.data?.link || window.location.origin;
            const grupoIdPayload = payload?.data?.grupoId || "";
            const ts = payload?.data?.ts || String(Date.now());

            const reg =
              (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
              (await navigator.serviceWorker.ready);

            if (!reg) return;

            if (esDispositivoMovilReal()) {
              console.log("📩 Push recibido en foreground móvil:", payload);

              await reg.showNotification(title, {
                body,
                icon: "/vite.svg",
                badge: "/vite.svg",
                data: { link, grupoId: grupoIdPayload, ts },
                tag: `gasto-${grupoIdPayload}-${ts}`,
                renotify: false,
                requireInteraction: false
              });
            } else {
              console.log("📩 Push recibido en foreground escritorio:", payload);
            }
          } catch (e) {
            console.error("onMessage error:", e);
          }
        });
      } catch (e) {
        console.error(e);
      }
    };

    if ("Notification" in window && "serviceWorker" in navigator) initForegroundListener();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuAbierto(false);
  }, [vista]);

  useEffect(() => {
    const syncPushTokenConUsuarioYGrupo = async () => {
      try {
        const token = localStorage.getItem("fcmToken");
        if (!token) return;

        await guardarTokenEnFirestore(token, localStorage.getItem("notificationsEnabled") !== "false", {
          uid: usuarioAuth?.uid || "",
          email: userProfile?.email || usuarioAuth?.email || "",
          nombre: userProfile?.nombre || "",
          grupoId: grupoId || "",
          grupoNombre: groupProfile?.nombre || userProfile?.grupoNombre || ""
        });
      } catch (e) {
        console.error("❌ syncPushTokenConUsuarioYGrupo:", e);
      }
    };

    if (usuarioAuth?.uid && userProfile) syncPushTokenConUsuarioYGrupo();
  }, [usuarioAuth, userProfile, grupoId, groupProfile]);

  const opcionesMesAnio = useMemo(() => {
    const base = [];
    const yearStart = new Date().getFullYear() - 2;
    const yearEnd = new Date().getFullYear() + 3;

    for (let anio = yearStart; anio <= yearEnd; anio++) {
      for (let mes = 1; mes <= 12; mes++) {
        base.push({
          value: `${anio}-${String(mes).padStart(2, "0")}`,
          label: `${MESES[mes - 1]} ${anio}`,
          anio,
          mes
        });
      }
    }

    return base;
  }, []);

  const valorMesAnio = `${anioActual}-${String(mesActual).padStart(2, "0")}`;
  const valorCalMesAnio = `${calAnio}-${String(calMes).padStart(2, "0")}`;

  const formatearComercio = (texto) => {
    if (!texto) return "";
    return texto
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  const COLORES_GRAFICO = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

  const generarColorGrafico = (index, total) => {
    if (index < COLORES_GRAFICO.length) return COLORES_GRAFICO[index];
    const offset = index - COLORES_GRAFICO.length;
    const totalExtra = Math.max(total - COLORES_GRAFICO.length, 1);
    const hue = Math.round((offset * 360) / totalExtra);
    return `hsl(${hue}, 68%, 56%)`;
  };

  const getDebtInfo = (bal) => {
    if (!participanteA || !participanteB) {
      return { debtorName: "", creditorName: "", amount: 0 };
    }

    if (bal > 0) return { debtorName: participanteB.nombre, creditorName: participanteA.nombre, amount: bal };
    if (bal < 0) return { debtorName: participanteA.nombre, creditorName: participanteB.nombre, amount: Math.abs(bal) };
    return { debtorName: "", creditorName: "", amount: 0 };
  };

  const idLiquidacion = `${anioActual}-${String(mesActual).padStart(2, "0")}`;

  useEffect(() => {
    if (!grupoId) {
      setGastos([]);
      setBalance(0);
      return;
    }

    const q = query(collection(db, "grupos", grupoId, "gastos"));
    const unsub = onSnapshot(q, (snapshot) => {
      let totalPagadoA = 0;
      let totalDebeA = 0;
      let lista = [];

      snapshot.forEach((documento) => {
        const data = documento.data();

        if (data.mes === mesActual && data.anio === anioActual && data.liquidado === false) {
          lista.push({ id: documento.id, ...data });

          const importeNum = Number(data.importe || 0);
          const participantesCount = Math.max(
            Number(data.participantesCount || 0),
            Array.isArray(data.divididoEntre) ? data.divididoEntre.length : 0,
            1
          );
          const parte = importeNum / participantesCount;

          if (participanteA?.email && data.pagadoPor === participanteA.email) {
            totalPagadoA += importeNum;
          }

          if (participanteA?.email) {
            if (Array.isArray(data.divididoEntre) && data.divididoEntre.includes(participanteA.email)) {
              totalDebeA += parte;
            } else if (!Array.isArray(data.divididoEntre) && data.pagadoPor === participanteA.email) {
              totalDebeA += parte;
            }
          }
        }
      });

      lista.sort((a, b) => {
        if (!a.fecha || !b.fecha) return 0;
        return b.fecha.seconds - a.fecha.seconds;
      });

      setGastos(lista);
      setBalance(totalPagadoA - totalDebeA);
    });

    return () => unsub();
  }, [grupoId, mesActual, anioActual, participanteA?.email]);

  useEffect(() => {
    if (!grupoId) {
      setLiquidacionGuardada(null);
      return;
    }

    const ref = doc(db, "grupos", grupoId, "liquidaciones", idLiquidacion);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() || {};
          setLiquidacionGuardada({
            status: data.status || null,
            debtor: data.debtor || "",
            creditor: data.creditor || "",
            amount: typeof data.amount === "number" ? data.amount : 0
          });
        } else {
          setLiquidacionGuardada(null);
        }
      },
      (e) => {
        console.error(e);
        setLiquidacionGuardada(null);
      }
    );

    return () => unsub();
  }, [grupoId, idLiquidacion]);

  useEffect(() => {
    if (balance === 0) {
      setEstadoDeuda(null);
      return;
    }

    if (!liquidacionGuardada || !liquidacionGuardada.status) {
      setEstadoDeuda(null);
      return;
    }

    const actual = getDebtInfo(balance);

    const mismoDeudor = (liquidacionGuardada.debtor || "") === actual.debtorName;
    const mismoAcreedor = (liquidacionGuardada.creditor || "") === actual.creditorName;

    const actualAmount2 = Number(actual.amount.toFixed(2));
    const guardadoAmount2 = Number(Number(liquidacionGuardada.amount || 0).toFixed(2));
    const mismoImporte = actualAmount2 === guardadoAmount2;

    if (mismoDeudor && mismoAcreedor && mismoImporte) setEstadoDeuda(liquidacionGuardada.status);
    else setEstadoDeuda(null);
  }, [balance, liquidacionGuardada, participanteA, participanteB]);

  useEffect(() => {
    if (!grupoId) {
      const defaults = {};
      SUPERS.forEach((s) => (defaults[s.key] = s.defaultName));
      setNombresSupers(defaults);
      return;
    }

    const ref = doc(db, "grupos", grupoId, "config", "supers");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() || {};
          const merged = {};
          SUPERS.forEach((s) => {
            merged[s.key] = data[s.key] || s.defaultName;
          });
          setNombresSupers(merged);
        } else {
          const defaults = {};
          SUPERS.forEach((s) => (defaults[s.key] = s.defaultName));
          setNombresSupers(defaults);
        }
      },
      (e) => {
        console.error(e);
      }
    );

    return () => unsub();
  }, [grupoId]);

  const abrirEditarSuper = (superKey) => {
    setSuperEditando(superKey);
    setEditSuperNombre(nombresSupers[superKey] || superKey);
  };

  const guardarNombreSuper = async () => {
    if (!superEditando || !grupoId) return;
    const nuevo = (editSuperNombre || "").trim();
    if (!nuevo) return;

    try {
      await setDoc(doc(db, "grupos", grupoId, "config", "supers"), { [superEditando]: nuevo }, { merge: true });
    } catch (e) {
      console.error(e);
    }

    setSuperEditando(null);
    setEditSuperNombre("");
  };

  useEffect(() => {
    if (!grupoId) {
      setProductos([]);
      return;
    }

    const q = query(collection(db, "grupos", grupoId, "listaCompra"));
    const unsub = onSnapshot(q, (snapshot) => {
      let lista = [];
      snapshot.forEach((docu) => lista.push({ id: docu.id, ...docu.data() }));
      setProductos(lista);
    });
    return () => unsub();
  }, [grupoId]);

  const setInputSuper = (superKey, value) => {
    setInputsSuper((prev) => ({ ...prev, [superKey]: value }));
  };

  const agregarProducto = async (superKey) => {
    if (!grupoId) return;

    const texto = (inputsSuper[superKey] || "").trim();
    if (!texto) return;

    await addDoc(collection(db, "grupos", grupoId, "listaCompra"), {
      nombre: texto,
      comprado: false,
      fecha: new Date(),
      super: superKey
    });

    setInputSuper(superKey, "");
  };

  const toggleComprado = async (producto) => {
    if (!grupoId) return;
    await updateDoc(doc(db, "grupos", grupoId, "listaCompra", producto.id), { comprado: !producto.comprado });
  };

  const confirmarEliminarProducto = async () => {
    if (!productoAEliminar || !grupoId) return;
    await deleteDoc(doc(db, "grupos", grupoId, "listaCompra", productoAEliminar.id));
    setProductoAEliminar(null);
  };

  const guardarEdicionProducto = async () => {
    if (!productoEditando || !grupoId) return;
    const nombreLimpio = (editProductoNombre || "").trim();
    if (!nombreLimpio) return;
    await updateDoc(doc(db, "grupos", grupoId, "listaCompra", productoEditando.id), { nombre: nombreLimpio });
    setProductoEditando(null);
  };

  const limpiarComprados = (superKey) => {
    const comprados = productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado);
    if (comprados.length === 0) return;
    setLimpiarCompradosConfirm({ open: true, superKey });
  };

  const confirmarLimpiarComprados = async () => {
    if (!grupoId) return;

    const superKey = limpiarCompradosConfirm.superKey;
    if (!superKey) {
      setLimpiarCompradosConfirm({ open: false, superKey: null });
      return;
    }

    const comprados = productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado);
    if (comprados.length === 0) {
      setLimpiarCompradosConfirm({ open: false, superKey: null });
      return;
    }

    const batch = writeBatch(db);
    comprados.forEach((p) => batch.delete(doc(db, "grupos", grupoId, "listaCompra", p.id)));
    await batch.commit();
    setLimpiarCompradosConfirm({ open: false, superKey: null });
  };

  const productosOrdenadosPorSuper = (superKey) => {
    return productos
      .filter((p) => (p.super || "MERCADONA") === superKey)
      .sort((a, b) => {
        const aC = a.comprado ? 1 : 0;
        const bC = b.comprado ? 1 : 0;
        if (aC !== bC) return aC - bC;
        return (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0);
      });
  };

  const totalCompradosSuper = (superKey) =>
    productos.filter((p) => (p.super || "MERCADONA") === superKey && p.comprado).length;

  const totalPendientesSuper = (superKey) =>
    productos.filter((p) => (p.super || "MERCADONA") === superKey && !p.comprado).length;

  const agregarGasto = async () => {
    if (!importe || !comercio || !grupoId) return;
    if (!pagadoPor) return;

    try {
      const importeNum = Number(importe);
      if (!Number.isFinite(importeNum) || importeNum <= 0) return;

      const comercioFmt = formatearComercio(comercio);
      const emailsParticipantes = participantesGrupo.map((p) => p.email).filter(Boolean);
      const participantesCount = Math.max(emailsParticipantes.length, 1);

      await addDoc(collection(db, "grupos", grupoId, "gastos"), {
        importe: importeNum,
        pagadoPor,
        mes: mesActual,
        anio: anioActual,
        liquidado: false,
        divididoEntre: emailsParticipantes,
        participantesCount,
        comercio: comercioFmt,
        fecha: new Date()
      });

      const quien = getNombreUsuarioPorEmail(pagadoPor);
      const euros = importeNum.toFixed(2).replace(".", ",");

      const pushResult = await enviarPushAGrupoActual({
        title: "💸 Nuevo gasto",
        body: `${quien} pagó ${euros}€ en ${comercioFmt}`,
        link: window.location.origin
      });

      if (!pushResult?.ok) {
        console.warn("⚠️ El gasto se guardó, pero el push falló:", pushResult);
      }

      setImporte("");
      setComercio("");
    } catch (e) {
      console.error("❌ Error en agregarGasto:", e);
    }
  };

  const confirmarEliminar = async () => {
    if (!gastoAEliminar || !grupoId) return;
    await deleteDoc(doc(db, "grupos", grupoId, "gastos", gastoAEliminar.id));
    setGastoAEliminar(null);
  };

  const abrirModalEditar = (gasto) => {
    setGastoEditando(gasto);
    setEditComercio(gasto.comercio);
    setEditImporte(gasto.importe);
    setEditPagadoPor(gasto.pagadoPor);
  };

  const guardarEdicion = async () => {
    if (!gastoEditando || !grupoId) return;

    await updateDoc(doc(db, "grupos", grupoId, "gastos", gastoEditando.id), {
      comercio: formatearComercio(editComercio),
      importe: Number(editImporte),
      pagadoPor: editPagadoPor
    });
    setGastoEditando(null);
  };

  const liquidarMes = () => {
    if (balance === 0) return;
    setLiquidarConfirmOpen(true);
  };

  const guardarEstadoLiquidacion = async (status) => {
    if (!grupoId) return;

    const info = getDebtInfo(balance);
    if (!info.debtorName || info.amount === 0) {
      setEstadoDeuda(null);
      setLiquidacionGuardada(null);
      setLiquidarConfirmOpen(false);
      return;
    }

    try {
      await setDoc(
        doc(db, "grupos", grupoId, "liquidaciones", idLiquidacion),
        {
          status,
          mes: mesActual,
          anio: anioActual,
          debtor: info.debtorName,
          creditor: info.creditorName,
          amount: Number(Number(info.amount).toFixed(2)),
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }

    setLiquidarConfirmOpen(false);
  };

  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

  const getMonthRange = (y, m) => {
    const start = `${y}-${pad2(m)}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;
    return { start, end, lastDay };
  };

  useEffect(() => {
    if (!grupoId) {
      setEventos([]);
      return;
    }

    const { start, end } = getMonthRange(calAnio, calMes);

    const qEv = query(
      collection(db, "grupos", grupoId, "eventos"),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
      orderBy("fecha", "asc")
    );

    const unsub = onSnapshot(
      qEv,
      (snapshot) => {
        let lista = [];
        snapshot.forEach((docu) => lista.push({ id: docu.id, ...docu.data() }));

        lista.sort((a, b) => {
          const fa = a.fecha || "";
          const fb = b.fecha || "";
          if (fa !== fb) return fa.localeCompare(fb);
          const ha = a.hora || "99:99";
          const hb = b.hora || "99:99";
          return ha.localeCompare(hb);
        });

        setEventos(lista);
      },
      (err) => {
        console.error("Calendario snapshot error:", err);
        setEventos([]);
      }
    );

    return () => unsub();
  }, [grupoId, calMes, calAnio]);

  const abrirNuevoEvento = (fechaPreseleccionada) => {
    setEvTitulo("");
    setEvTipo("OTRO");
    setEvNotas("");
    setEvHora("00:00");
    setEvFecha(fechaPreseleccionada || ymd(calAnio, calMes, new Date().getDate()));
    setEventoNuevoOpen(true);
  };

  const guardarNuevoEvento = async () => {
    if (!grupoId) return;

    const t = (evTitulo || "").trim();
    const f = (evFecha || "").trim();
    if (!t || !f) return;

    const horaFinal = (evHora || "").trim() || "00:00";
    const eventAt = new Date(`${f}T${horaFinal}:00`);

    await addDoc(collection(db, "grupos", grupoId, "eventos"), {
      titulo: t,
      tipo: (evTipo || "OTRO").trim(),
      fecha: f,
      hora: horaFinal,
      notas: (evNotas || "").trim(),
      eventAt,
      notificado: false,
      createdAt: new Date()
    });

    setEventoNuevoOpen(false);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEditando(ev);
    setEvTitulo(ev.titulo || "");
    setEvTipo(ev.tipo || "OTRO");
    setEvFecha(ev.fecha || "");
    setEvHora(ev.hora && ev.hora.trim() ? ev.hora : "00:00");
    setEvNotas(ev.notas || "");
  };

  const guardarEdicionEvento = async () => {
    if (!eventoEditando || !grupoId) return;

    const t = (evTitulo || "").trim();
    const f = (evFecha || "").trim();
    if (!t || !f) return;

    const horaFinal = (evHora || "").trim() || "00:00";
    const eventAt = new Date(`${f}T${horaFinal}:00`);

    await updateDoc(doc(db, "grupos", grupoId, "eventos", eventoEditando.id), {
      titulo: t,
      tipo: (evTipo || "OTRO").trim(),
      fecha: f,
      hora: horaFinal,
      notas: (evNotas || "").trim(),
      eventAt,
      notificado: false,
      updatedAt: new Date()
    });

    setEventoEditando(null);
  };

  const confirmarEliminarEvento = async () => {
    if (!eventoAEliminar || !grupoId) return;
    await deleteDoc(doc(db, "grupos", grupoId, "eventos", eventoAEliminar.id));
    setEventoAEliminar(null);
  };

  const COLORES_EVENTOS_DIA = useMemo(() => ["#a855f7", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"], []);
  const colorEventoPorIndice = (idx) => COLORES_EVENTOS_DIA[idx % COLORES_EVENTOS_DIA.length];

  const eventosPorFecha = {};
  eventos.forEach((ev) => {
    const f = ev.fecha || "";
    if (!eventosPorFecha[f]) eventosPorFecha[f] = [];
    eventosPorFecha[f].push(ev);
  });

  Object.keys(eventosPorFecha).forEach((f) => {
    eventosPorFecha[f].sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));
  });

  const abrirDetalleDia = (fechaStr) => {
    setDiaDetalleFecha(fechaStr);
    setDiaDetalleOpen(true);
  };

  const eventosDelDiaDetalle = diaDetalleFecha && eventosPorFecha[diaDetalleFecha] ? eventosPorFecha[diaDetalleFecha] : [];

  const irMesAnterior = () => {
    let m = calMes - 1;
    let y = calAnio;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCalMes(m);
    setCalAnio(y);
  };

  const irMesSiguiente = () => {
    let m = calMes + 1;
    let y = calAnio;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalMes(m);
    setCalAnio(y);
  };

  const irHoy = () => {
    const now = new Date();
    setCalMes(now.getMonth() + 1);
    setCalAnio(now.getFullYear());
  };

  const resumenComercio = {};
  gastos.forEach((g) => {
    if (!resumenComercio[g.comercio]) resumenComercio[g.comercio] = 0;
    resumenComercio[g.comercio] += Number(g.importe || 0);
  });

  const dataGraficoBase = Object.entries(resumenComercio)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const dataGrafico = dataGraficoBase.map((item, index) => ({
    ...item,
    color: generarColorGrafico(index, dataGraficoBase.length)
  }));

  const dataGraficoOrdenado = dataGrafico.slice().sort((a, b) => b.total - a.total);

  const totalPorEmail = {};
  gastos.forEach((g) => {
    if (!totalPorEmail[g.pagadoPor]) totalPorEmail[g.pagadoPor] = 0;
    totalPorEmail[g.pagadoPor] += Number(g.importe || 0);
  });

  const totalParticipanteA = participanteA?.email ? totalPorEmail[participanteA.email] || 0 : 0;
  const totalParticipanteB = participanteB?.email ? totalPorEmail[participanteB.email] || 0 : 0;
  const totalMes = totalParticipanteA + totalParticipanteB;

  const debtInfo = getDebtInfo(balance);

  const getBalanceCardStyle = () => {
    if (balance === 0) return styles.balanceCard;
    if (estadoDeuda === "paid") return { ...styles.balanceCard, ...styles.balanceCardPaid };
    if (estadoDeuda === "unpaid") return { ...styles.balanceCard, ...styles.balanceCardUnpaid };
    return styles.balanceCard;
  };

  const renderBalanceText = () => {
    if (!participanteA || !participanteB) {
      return <h2>👥 Falta que se una la otra persona al grupo</h2>;
    }

    if (balance === 0) return <h2 style={styles.balanceNeutralText}>Nadie debe nada 😜</h2>;

    if (estadoDeuda === "paid") {
      return <h2 style={styles.balanceCardBigText}>{`${debtInfo.debtorName} HA PAGADO LA DEUDA DE ${debtInfo.amount.toFixed(2)} €`}</h2>;
    }

    if (estadoDeuda === "unpaid") {
      return <h2 style={styles.balanceCardBigText}>{`${debtInfo.debtorName} NO HA PAGADO LA DEUDA DE ${debtInfo.amount.toFixed(2)} €`}</h2>;
    }

    if (balance > 0) return <h2>{participanteB.nombre} debe {balance.toFixed(2)} € a {participanteA.nombre}</h2>;
    return <h2>{participanteA.nombre} debe {Math.abs(balance).toFixed(2)} € a {participanteB.nombre}</h2>;
  };

  const chartHeight = isMobile ? 320 : 440;
  const innerRadius = isMobile ? 62 : 96;
  const outerRadius = isMobile ? 102 : 148;
  const centerHoleRadius = innerRadius - 10;
  const centerMainFont = isMobile ? 18 : 24;
  const centerSubFont = isMobile ? 12 : 14;

  const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const { lastDay } = getMonthRange(calAnio, calMes);

  const firstDowNative = new Date(calAnio, calMes - 1, 1).getDay();
  const firstDowMonday0 = (firstDowNative + 6) % 7;
  const totalCeldas = Math.ceil((firstDowMonday0 + lastDay) / 7) * 7;

  const buildCalendarCells = () => {
    const celdas = [];
    for (let i = 0; i < totalCeldas; i++) {
      const dayNum = i - firstDowMonday0 + 1;
      if (dayNum < 1 || dayNum > lastDay) celdas.push({ empty: true, key: `e-${i}` });
      else {
        const fechaStr = ymd(calAnio, calMes, dayNum);
        const esHoy = fechaStr === ymd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
        celdas.push({ empty: false, key: fechaStr, dayNum, fechaStr, esHoy });
      }
    }
    return celdas;
  };

  const calendarCells = buildCalendarCells();

  const dashboardTitleStyle = isMobile
    ? {
        ...styles.title,
        fontSize: "22px",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        margin: "0 auto 20px auto"
      }
    : styles.title;

  const listTitleStyle = isMobile
    ? {
        ...styles.title,
        fontSize: "20px",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        margin: "0 auto 20px auto"
      }
    : styles.title;

  const topTabsContainerStyle = isMobile
    ? styles.topTabsContainerMobile
    : styles.topTabsContainer;

  if (authLoading) {
    return (
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={styles.card}>
          <h2>Cargando...</h2>
        </div>
      </div>
    );
  }

  if (!usuarioAuth) {
    const authTitle =
      authMode === "login"
        ? "🔐 Iniciar sesión"
        : authMode === "register-create"
          ? "✨ Crear cuenta y grupo"
          : "🤝 Unirme a un grupo";

    const authSubtitle =
      authMode === "login"
        ? "Accede a tu grupo y sigue gestionando gastos, lista de compra y calendario."
        : authMode === "register-create"
          ? "Crea tu espacio compartido y entra directamente sin pasos extra."
          : "Únete con tu código, crea tu cuenta y entra directamente en la app.";

    const authButtonText =
      authMode === "login"
        ? authBusy ? "Entrando..." : "Entrar"
        : authMode === "register-create"
          ? authBusy ? "Creando..." : "Crear cuenta y grupo"
          : authBusy ? "Uniendo..." : "Crear cuenta y unirme";

    const authButtonStyle = authMode === "login" ? styles.authPrimaryButtonBlue : styles.authPrimaryButtonGreen;

    return (
      <div style={{ ...styles.authScreen, padding: isMobile ? "16px" : "24px" }}>
        <div style={styles.authGlowOne} />
        <div style={styles.authGlowTwo} />

        <div
          style={{
            ...styles.authWrapper,
            maxWidth: isMobile ? "520px" : "1160px",
            gridTemplateColumns: isMobile ? "1fr" : "1.05fr 0.95fr",
            gap: isMobile ? "0px" : "28px",
            alignItems: "center"
          }}
        >
          {!isMobile && (
            <div style={styles.authBrandBlock}>
              <div style={styles.authBrandBadge}>GESTIÓN MDEKOT</div>
              <h1 style={styles.authHeroTitle}>Comparte gastos y organización en una sola app</h1>
              <p style={styles.authHeroText}>
                Controla el mes, la compra y el calendario del grupo con una interfaz clara, rápida y hecha para usarla cada día.
              </p>

              <div style={styles.authFeatureGrid}>
                <div style={styles.authFeatureCard}>
                  <div style={styles.authFeatureIcon}>💸</div>
                  <div style={styles.authFeatureTitle}>Gastos</div>
                  <div style={styles.authFeatureText}>Balance mensual, comercios y liquidación.</div>
                </div>
                <div style={styles.authFeatureCard}>
                  <div style={styles.authFeatureIcon}>🛒</div>
                  <div style={styles.authFeatureTitle}>Compra</div>
                  <div style={styles.authFeatureText}>Lista separada por supermercados y seguimiento rápido.</div>
                </div>
                <div style={styles.authFeatureCard}>
                  <div style={styles.authFeatureIcon}>📅</div>
                  <div style={styles.authFeatureTitle}>Calendario</div>
                  <div style={styles.authFeatureText}>Eventos del grupo siempre visibles y ordenados.</div>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              ...styles.authCard,
              maxWidth: isMobile ? "100%" : "500px",
              borderRadius: isMobile ? "20px" : "24px",
              padding: isMobile ? "20px 16px" : "26px"
            }}
          >
            <div style={styles.authCardTop}>
              <h2 style={{ ...styles.authTitle, fontSize: isMobile ? "24px" : "30px" }}>{authTitle}</h2>
              <p style={{ ...styles.authSubtitle, fontSize: isMobile ? "13px" : "14px" }}>{authSubtitle}</p>
            </div>

            <div
              style={{
                ...styles.authTabsWrap,
                gap: isMobile ? "6px" : "8px",
                padding: isMobile ? "6px" : "7px"
              }}
            >
              <button
                onClick={() => { setAuthMode("login"); setLoginError(""); }}
                style={
                  authMode === "login"
                    ? { ...styles.authTabActive, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                    : { ...styles.authTab, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                }
              >
                Entrar
              </button>

              <button
                onClick={() => { setAuthMode("register-create"); setLoginError(""); }}
                style={
                  authMode === "register-create"
                    ? { ...styles.authTabActive, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                    : { ...styles.authTab, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                }
              >
                Crear grupo
              </button>

              <button
                onClick={() => { setAuthMode("register-join"); setLoginError(""); }}
                style={
                  authMode === "register-join"
                    ? { ...styles.authTabActive, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                    : { ...styles.authTab, padding: isMobile ? "10px 4px" : "11px 8px", fontSize: isMobile ? "12px" : "13px" }
                }
              >
                Unirme
              </button>
            </div>

            <div style={styles.authForm}>
              {authMode !== "login" && (
                <>
                  <input
                    type="text"
                    placeholder="Nombre para mostrar"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
                  />

                  <select
                    value={registerGender}
                    onChange={(e) => setRegisterGender(e.target.value)}
                    style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
                  >
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                  </select>
                </>
              )}

              {authMode === "register-create" && (
                <input
                  type="text"
                  placeholder="Nombre del grupo"
                  value={registerGroupName}
                  onChange={(e) => setRegisterGroupName(e.target.value)}
                  style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
                />
              )}

              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
              />

              {authMode === "register-join" && (
                <input
                  type="text"
                  placeholder="Código de invitación"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(normalizarCodigoInvitacion(e.target.value))}
                  style={{ ...styles.authInput, padding: isMobile ? "14px 14px" : "15px 16px", fontSize: isMobile ? "14px" : "15px" }}
                />
              )}

              {loginError ? <div style={styles.authErrorBox}>{loginError}</div> : null}

              {authMode === "login" && (
                <button onClick={iniciarSesion} style={{ ...authButtonStyle, opacity: authBusy ? 0.85 : 1 }} disabled={authBusy}>
                  {authButtonText}
                </button>
              )}

              {authMode === "register-create" && (
                <button onClick={crearCuentaYGrupo} style={{ ...authButtonStyle, opacity: authBusy ? 0.85 : 1 }} disabled={authBusy}>
                  {authButtonText}
                </button>
              )}

              {authMode === "register-join" && (
                <button onClick={crearCuentaYUnirseAGrupo} style={{ ...authButtonStyle, opacity: authBusy ? 0.85 : 1 }} disabled={authBusy}>
                  {authButtonText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading || authBootstrapActive) {
    return (
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...styles.card, maxWidth: "420px", width: "100%" }}>
          <h2 style={{ marginBottom: "10px" }}>Cargando perfil...</h2>
          <p style={{ opacity: 0.85, margin: 0 }}>Estamos preparando tu acceso.</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...styles.card, maxWidth: "420px", width: "100%" }}>
          <h2 style={{ marginBottom: "12px" }}>Perfil no encontrado</h2>
          <p style={{ marginBottom: "16px" }}>No se encontró el perfil del usuario en Firestore.</p>
          <button onClick={cerrarSesion} style={styles.buttonDanger}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, padding: isMobile ? "16px" : "40px" }}>
      <button
        onClick={() => setMenuAbierto(true)}
        style={styles.hamburgerButton}
        aria-label="Abrir menú"
        title="Abrir menú"
      >
        ☰
      </button>

      {menuAbierto && <div style={styles.menuOverlay} onClick={() => setMenuAbierto(false)} />}

      <div
        style={{
          ...styles.sideMenu,
          transform: menuAbierto ? "translateX(0)" : "translateX(-100%)"
        }}
      >
        <div style={styles.sideMenuHeader}>
          <div style={styles.sideMenuAvatar}>
            {(userProfile?.nombre || usuarioAuth?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.sideMenuUserName}>{userProfile?.nombre || usuarioAuth?.email || "Usuario"}</div>
            <div style={styles.sideMenuSubtext}>{groupProfile?.nombre || userProfile?.grupoNombre || "Sin grupo"}</div>
          </div>
        </div>

        <div style={styles.sideMenuSection}>
          <div style={styles.sideMenuItem}>
            <span style={styles.sideMenuLabel}>Usuario</span>
            <span style={styles.sideMenuValue}>{userProfile?.nombre || usuarioAuth?.email || "Usuario"}</span>
          </div>

          <div style={styles.sideMenuItem}>
            <span style={styles.sideMenuLabel}>Grupo</span>
            <span style={styles.sideMenuValue}>{groupProfile?.nombre || userProfile?.grupoNombre || "Sin grupo"}</span>
          </div>

          {userProfile?.grupoCodigo ? (
            <div style={styles.sideMenuItem}>
              <span style={styles.sideMenuLabel}>Código invitación</span>
              <span style={styles.sideMenuValue}>{userProfile.grupoCodigo}</span>
            </div>
          ) : null}
        </div>

        <div style={styles.sideMenuDivider} />

        <div style={styles.sideMenuSection}>
          <button
            onClick={toggleNotificaciones}
            style={notificacionesActivas ? styles.sideMenuNotifOn : styles.sideMenuNotifOff}
            title={pushReady ? "Activar u ocultar notificaciones en este dispositivo" : "Se configurará automáticamente cuando el navegador lo permita"}
          >
            {notificacionesActivas ? "🔔 Notificaciones activadas" : "🔕 Notificaciones desactivadas"}
          </button>
        </div>

        <div style={{ marginTop: "auto" }}>
          <button onClick={cerrarSesion} style={{ ...styles.buttonDanger, width: "100%" }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={topTabsContainerStyle}>
        <button onClick={() => setVista("dashboard")} style={vista === "dashboard" ? styles.topTabActive : styles.topTab}>Gastos</button>
        <button onClick={() => setVista("grafico")} style={vista === "grafico" ? styles.topTabActive : styles.topTab}>Gráfico</button>
        <button onClick={() => setVista("lista")} style={vista === "lista" ? styles.topTabActive : styles.topTab}>Listas</button>
        <button onClick={() => setVista("calendario")} style={vista === "calendario" ? styles.topTabActive : styles.topTab}>Calendario</button>
      </div>

      {vista === "dashboard" && (
        <>
          <h1 style={dashboardTitleStyle}>💰💶 GESTIÓN MDEKOT 💶💰</h1>

          <div style={styles.selectorRow}>
            <select
              value={valorMesAnio}
              onChange={(e) => {
                const [anio, mes] = e.target.value.split("-");
                setAnioActual(Number(anio));
                setMesActual(Number(mes));
              }}
              style={styles.monthYearSelect}
            >
              {opcionesMesAnio.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div style={getBalanceCardStyle()}>{renderBalanceText()}</div>

          <div style={styles.cardFull}>
            <h3>· Añadir Nuevo Gasto ·</h3>
            <div style={styles.formContainer}>
              <input type="text" placeholder="Comercio" value={comercio} onChange={(e) => setComercio(e.target.value)} style={styles.inputCompact} />
              <input type="number" placeholder="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} style={styles.inputCompact} />
              <select value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} style={styles.inputCompact}>
                {participantesGrupo.map((p) => (
                  <option key={p.email} value={p.email}>{p.nombre}</option>
                ))}
              </select>
              <button onClick={agregarGasto} style={styles.button}>Guardar</button>
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>· GASTOS DEL MES ·</h3>
              {gastos.map((g) => {
                const nombrePagador = getNombreUsuarioPorEmail(g.pagadoPor);
                const sexoPagador = getGeneroPorEmail(g.pagadoPor);
                const badgeStyle = getBadgeStyleByGender(sexoPagador);
                const badgeIcon = getBadgeIconByGender(sexoPagador);
                const badgeTitle = `Pagó ${nombrePagador}`;

                return (
                  <div key={g.id} style={{ ...styles.gastoItem, alignItems: "center", flexWrap: "nowrap" }}>
                    <div style={styles.gastoLeft}>
                      <span title={badgeTitle} style={{ ...styles.payIcon, ...badgeStyle, flexShrink: 0 }}>{badgeIcon}</span>
                      <span
                        title={`${g.fecha ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "--/--"} - ${g.comercio}`}
                        style={styles.gastoTexto}
                      >
                        {g.fecha ? new Date(g.fecha.seconds * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "--/--"} - {g.comercio}
                      </span>
                    </div>

                    <div style={styles.gastoRight}>
                      <span style={styles.gastoImporte}>{Number(g.importe).toFixed(2)} €</span>
                      <div style={styles.mobileIconButtonsWrap}>
                        <button onClick={() => abrirModalEditar(g)} style={styles.buttonEditMini}>✏</button>
                        <button onClick={() => setGastoAEliminar(g)} style={styles.buttonDeleteMini}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.card}>
              <h3>· TOTAL POR COMERCIO ·</h3>
              {Object.entries(resumenComercio).map(([nombre, total]) => (<p key={nombre}>{nombre} → {total.toFixed(2)} €</p>))}
            </div>

            <div style={styles.card}>
              <h3>· GASTO INDIVIDUAL ·</h3>
              <div style={styles.gastoIndividualWrap}>
                {participanteA ? (
                  <div style={styles.gastoIndividualRow}>
                    <span title={`Pagó ${participanteA.nombre}`} style={{ ...styles.payIcon, ...getBadgeStyleByGender(participanteA.sexo) }}>
                      {getBadgeIconByGender(participanteA.sexo)}
                    </span>
                    <span style={styles.gastoIndividualNombre}>{participanteA.nombre}</span>
                    <span style={styles.gastoIndividualArrow}>→</span>
                    <span style={styles.gastoIndividualImporte}>{totalParticipanteA.toFixed(2)} €</span>
                  </div>
                ) : null}

                {participanteB ? (
                  <div style={styles.gastoIndividualRow}>
                    <span title={`Pagó ${participanteB.nombre}`} style={{ ...styles.payIcon, ...getBadgeStyleByGender(participanteB.sexo) }}>
                      {getBadgeIconByGender(participanteB.sexo)}
                    </span>
                    <span style={styles.gastoIndividualNombre}>{participanteB.nombre}</span>
                    <span style={styles.gastoIndividualArrow}>→</span>
                    <span style={styles.gastoIndividualImporte}>{totalParticipanteB.toFixed(2)} €</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={styles.card}>
              <h3>· TOTAL GASTOS ·</h3>
              <h2>{totalMes.toFixed(2)} €</h2>
            </div>
          </div>

          <div style={styles.buttonCenter}>
            <button onClick={liquidarMes} style={styles.buttonDanger} disabled={balance === 0}>Liquidar mes</button>
          </div>

          {liquidarConfirmOpen && balance !== 0 && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>💸 LIQUIDAR MES</h3>
                <p style={{ marginBottom: "18px" }}>¿{debtInfo.debtorName.toUpperCase()} HA PAGADO LA DEUDA DE {debtInfo.amount.toFixed(2)} €?</p>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <button onClick={() => setLiquidarConfirmOpen(false)} style={styles.button}>Cancelar</button>
                  <button onClick={() => guardarEstadoLiquidacion("unpaid")} style={styles.buttonDanger}>NO</button>
                  <button onClick={() => guardarEstadoLiquidacion("paid")} style={styles.buttonPaid}>SÍ</button>
                </div>
              </div>
            </div>
          )}

          {gastoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Gasto</h3>
                <input value={editComercio} onChange={(e) => setEditComercio(e.target.value)} style={styles.input} />
                <input type="number" value={editImporte} onChange={(e) => setEditImporte(e.target.value)} style={styles.input} />
                <select value={editPagadoPor} onChange={(e) => setEditPagadoPor(e.target.value)} style={styles.input}>
                  {participantesGrupo.map((p) => (
                    <option key={p.email} value={p.email}>{p.nombre}</option>
                  ))}
                </select>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setGastoEditando(null)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarEdicion} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {gastoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>¿Eliminar "{gastoAEliminar.comercio}" por {Number(gastoAEliminar.importe).toFixed(2)} €?</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setGastoAEliminar(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarEliminar} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {vista === "calendario" && (
        <>
          <h1 style={styles.title}>📅 CALENDARIO</h1>

          <div style={{ ...styles.calendarPageWrap, ...(isMobile ? styles.calendarPageWrapMobile : {}) }}>
            <div style={{ ...styles.cardFull, padding: isMobile ? "14px 12px" : "18px", marginBottom: isMobile ? "14px" : "30px" }}>
              <div style={{ ...styles.calHeader, flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button onClick={irMesAnterior} style={styles.button}>◀</button>
                  <button onClick={irHoy} style={styles.button}>Hoy</button>
                  <button onClick={irMesSiguiente} style={styles.button}>▶</button>
                </div>

                <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <select
                    value={valorCalMesAnio}
                    onChange={(e) => {
                      const [anio, mes] = e.target.value.split("-");
                      setCalAnio(Number(anio));
                      setCalMes(Number(mes));
                    }}
                    style={styles.monthYearSelect}
                  >
                    {opcionesMesAnio.map((op) => (
                      <option key={`cal-${op.value}`} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button onClick={() => abrirNuevoEvento(ymd(calAnio, calMes, 1))} style={styles.buttonAddCalendar}>+ Nuevo evento</button>
                </div>
              </div>
            </div>

            <div style={{ ...styles.calendarCard, ...(isMobile ? styles.calendarCardMobile : {}) }}>
              <div style={styles.calWeekHeaderUnified}>
                {diasSemana.map((d) => (<div key={d} style={styles.calWeekHeaderCellUnified}>{d}</div>))}
              </div>

              <div style={styles.calGridUnified}>
                {calendarCells.map((c) => {
                  const baseCellStyle = isMobile ? styles.calCellMobileDot : styles.calCellPcDot;
                  if (c.empty) return <div key={c.key} style={{ ...baseCellStyle, ...styles.calCellEmpty }} />;

                  const evs = eventosPorFecha[c.fechaStr] || [];
                  const hasEvents = evs.length > 0;

                  return (
                    <div key={c.key} style={{ ...baseCellStyle, ...(c.esHoy ? styles.calCellToday : {}) }} onClick={() => abrirDetalleDia(c.fechaStr)} title="Click para ver detalle del día">
                      <div style={styles.calCellDotTop}>
                        <span style={{ ...styles.calDayNumber, ...(c.esHoy ? styles.calDayNumberToday : {}) }}>{c.dayNum}</span>
                      </div>

                      {hasEvents ? (
                        <div style={styles.dotCenterWrap}>
                          <span style={isMobile ? styles.dotGreenMobile : styles.dotGreenPc} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {!isMobile && <div style={{ marginTop: "12px", opacity: 0.8, fontSize: "13px" }}>Tip: click en un día para ver detalle.</div>}
            </div>
          </div>

          {diaDetalleOpen && (
            <div style={styles.modalOverlay}>
              <div style={{ ...styles.modal, maxWidth: "420px" }}>
                <h3 style={{ marginTop: 0 }}>
                  📌{" "}
                  {diaDetalleFecha
                    ? new Date(diaDetalleFecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })
                    : "Día"}
                </h3>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                  <button onClick={() => abrirNuevoEvento(diaDetalleFecha)} style={styles.buttonAddCalendar}>+ Añadir evento a este día</button>
                </div>

                {eventosDelDiaDetalle.length === 0 ? (
                  <p>No hay eventos este día</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {eventosDelDiaDetalle.map((ev, idx) => (
                      <div key={ev.id} style={{ ...styles.dayDetailRow, borderLeft: `10px solid ${colorEventoPorIndice(idx)}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.titulo}</div>
                            <div style={{ opacity: 0.9, fontSize: "13px", textAlign: "left" }}>{ev.hora ? `${ev.hora}` : "00:00"}</div>
                            {ev.notas ? <div style={{ opacity: 0.9, fontSize: "13px", textAlign: "left", marginTop: "6px" }}>{ev.notas}</div> : null}
                          </div>

                          <div style={isMobile ? styles.mobileIconButtonsColumn : { display: "flex", gap: "8px", flexShrink: 0 }}>
                            <button onClick={() => abrirEditarEvento(ev)} style={styles.buttonEditMini}>✏</button>
                            <button onClick={() => setEventoAEliminar(ev)} style={styles.buttonDeleteMini}>🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px" }}>
                  <button onClick={() => setDiaDetalleOpen(false)} style={styles.button}>Cerrar</button>
                </div>
              </div>
            </div>
          )}

          {eventoNuevoOpen && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>📌 Nuevo Evento</h3>
                <input value={evTitulo} onChange={(e) => setEvTitulo(e.target.value)} style={styles.input} placeholder="Título (ej: Cumpleaños mamá)" />
                <input type="date" value={evFecha} onChange={(e) => setEvFecha(e.target.value)} style={styles.input} />
                <input type="time" value={evHora} onChange={(e) => setEvHora(e.target.value || "00:00")} style={styles.input} />
                <input value={evNotas} onChange={(e) => setEvNotas(e.target.value)} style={styles.input} placeholder="Notas (opcional)" />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setEventoNuevoOpen(false)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarNuevoEvento} style={styles.buttonPaid}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {eventoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Evento</h3>
                <input value={evTitulo} onChange={(e) => setEvTitulo(e.target.value)} style={styles.input} placeholder="Título" />
                <input type="date" value={evFecha} onChange={(e) => setEvFecha(e.target.value)} style={styles.input} />
                <input type="time" value={evHora} onChange={(e) => setEvHora(e.target.value || "00:00")} style={styles.input} />
                <input value={evNotas} onChange={(e) => setEvNotas(e.target.value)} style={styles.input} placeholder="Notas (opcional)" />

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", gap: "10px" }}>
                  <button onClick={() => setEventoEditando(null)} style={styles.button}>Cancelar</button>
                  <button onClick={() => { setEventoAEliminar(eventoEditando); setEventoEditando(null); }} style={styles.buttonDanger}>Eliminar</button>
                  <button onClick={guardarEdicionEvento} style={styles.buttonPaid}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {eventoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>¿Eliminar "{eventoAEliminar.titulo}"?</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setEventoAEliminar(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarEliminarEvento} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {vista === "lista" && (
        <>
          <h1 style={listTitleStyle}>🛒 LISTA DE LA COMPRA</h1>

          {isMobile ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
                <select value={superMobile} onChange={(e) => setSuperMobile(e.target.value)} style={styles.select}>
                  {SUPERS.map((s) => {
                    const nombreVisible = nombresSupers[s.key] || s.defaultName;
                    const pendientes = totalPendientesSuper(s.key);
                    return (
                      <option key={s.key} value={s.key}>
                        {nombreVisible} ({pendientes})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ ...styles.grid, gridTemplateColumns: "1fr", width: "100%", maxWidth: "100%", margin: "0 auto 30px auto" }}>
                {SUPERS.filter((s) => s.key === superMobile).map((s) => {
                  const lista = productosOrdenadosPorSuper(s.key);
                  const nombreVisible = nombresSupers[s.key] || s.defaultName;
                  const totalComprados = totalCompradosSuper(s.key);

                  return (
                    <div key={s.key} style={{ ...styles.card, padding: "16px 12px", margin: "0 auto" }}>
                      <div style={styles.cardHeaderRow}>
                        <h3 style={styles.cardTitle}>· {nombreVisible} ·</h3>
                        <button onClick={() => abrirEditarSuper(s.key)} style={styles.buttonSuperEdit} title="Renombrar supermercado">✎</button>
                      </div>

                      <div style={styles.superFormRow}>
                        <input type="text" placeholder="Añadir producto..." value={inputsSuper[s.key] || ""} onChange={(e) => setInputSuper(s.key, e.target.value)} style={{ ...styles.inputSuper, width: "100%", maxWidth: "none", minWidth: 0 }} />
                        <button onClick={() => agregarProducto(s.key)} style={styles.buttonAddInline}>Añadir</button>
                      </div>

                      {lista.length === 0 && <p>No hay productos</p>}

                      {lista.map((p) => (
                        <div key={p.id} style={{ ...styles.gastoItem, alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: p.comprado ? 0.55 : 1, flex: 1, minWidth: 0 }}>
                            <input type="checkbox" checked={p.comprado} onChange={() => toggleComprado(p)} style={{ accentColor: "#22c55e", flexShrink: 0 }} />
                            <span title={p.nombre} style={{ textDecoration: p.comprado ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1, textAlign: "left", fontSize: "14px", lineHeight: 1.2 }}>
                              {p.nombre}
                            </span>
                          </div>

                          <div style={styles.gastoRight}>
                            <div style={styles.mobileIconButtonsWrap}>
                              <button onClick={() => { setProductoEditando(p); setEditProductoNombre(p.nombre); }} style={styles.buttonEditMini}>✏</button>
                              <button onClick={() => setProductoAEliminar(p)} style={styles.buttonDeleteMini}>🗑</button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
                        <button onClick={() => limpiarComprados(s.key)} style={styles.buttonDangerSmall}>Borrar Comprados</button>
                      </div>

                      {limpiarCompradosConfirm.open && limpiarCompradosConfirm.superKey === s.key && (
                        <div style={styles.modalOverlay}>
                          <div style={styles.modal}>
                            <h3>🧹 Borrar comprados</h3>
                            <p style={{ marginBottom: "20px" }}>¿Eliminar {totalComprados} producto(s) ya comprados de {nombreVisible}?</p>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <button onClick={() => setLimpiarCompradosConfirm({ open: false, superKey: null })} style={styles.button}>Cancelar</button>
                              <button onClick={confirmarLimpiarComprados} style={styles.buttonDanger}>Eliminar</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={styles.grid}>
              {SUPERS.map((s) => {
                const lista = productosOrdenadosPorSuper(s.key);
                const nombreVisible = nombresSupers[s.key] || s.defaultName;
                const totalComprados = totalCompradosSuper(s.key);

                return (
                  <div key={s.key} style={styles.card}>
                    <div style={styles.cardHeaderRow}>
                      <h3 style={styles.cardTitle}>· {nombreVisible} ·</h3>
                      <button onClick={() => abrirEditarSuper(s.key)} style={styles.buttonSuperEdit} title="Renombrar supermercado">✎</button>
                    </div>

                    <div style={styles.superFormRow}>
                      <input type="text" placeholder="Añadir producto..." value={inputsSuper[s.key] || ""} onChange={(e) => setInputSuper(s.key, e.target.value)} style={styles.inputSuper} />
                      <button onClick={() => agregarProducto(s.key)} style={styles.buttonAddInline}>Añadir</button>
                    </div>

                    {lista.length === 0 && <p>No hay productos</p>}

                    {lista.map((p) => (
                      <div key={p.id} style={styles.gastoItem}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", opacity: p.comprado ? 0.55 : 1 }}>
                          <input type="checkbox" checked={p.comprado} onChange={() => toggleComprado(p)} style={{ accentColor: "#22c55e" }} />
                          <span style={{ textDecoration: p.comprado ? "line-through" : "none" }}>{p.nombre}</span>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => { setProductoEditando(p); setEditProductoNombre(p.nombre); }} style={styles.buttonEditMini}>✏</button>
                          <button onClick={() => setProductoAEliminar(p)} style={styles.buttonDeleteMini}>🗑</button>
                        </div>
                      </div>
                    ))}

                    <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
                      <button onClick={() => limpiarComprados(s.key)} style={styles.buttonDangerSmall}>Borrar Comprados</button>
                    </div>

                    {limpiarCompradosConfirm.open && limpiarCompradosConfirm.superKey === s.key && (
                      <div style={styles.modalOverlay}>
                        <div style={styles.modal}>
                          <h3>🧹 Borrar comprados</h3>
                          <p style={{ marginBottom: "20px" }}>¿Eliminar {totalComprados} producto(s) ya comprados de {nombreVisible}?</p>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <button onClick={() => setLimpiarCompradosConfirm({ open: false, superKey: null })} style={styles.button}>Cancelar</button>
                            <button onClick={confirmarLimpiarComprados} style={styles.buttonDanger}>Eliminar</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {productoEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✏ Editar Producto</h3>
                <input value={editProductoNombre} onChange={(e) => setEditProductoNombre(e.target.value)} style={styles.input} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => setProductoEditando(null)} style={styles.button}>Cancelar</button>
                  <button onClick={guardarEdicionProducto} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}

          {productoAEliminar && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>🗑 Confirmar eliminación</h3>
                <p style={{ marginBottom: "20px" }}>¿Eliminar "{productoAEliminar.nombre}" de la lista?</p>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setProductoAEliminar(null)} style={styles.button}>Cancelar</button>
                  <button onClick={confirmarEliminarProducto} style={styles.buttonDanger}>Eliminar</button>
                </div>
              </div>
            </div>
          )}

          {superEditando && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <h3>✎ Renombrar supermercado</h3>
                <input value={editSuperNombre} onChange={(e) => setEditSuperNombre(e.target.value)} style={styles.input} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <button onClick={() => { setSuperEditando(null); setEditSuperNombre(""); }} style={styles.button}>Cancelar</button>
                  <button onClick={guardarNombreSuper} style={styles.buttonDanger}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {vista === "grafico" && (
        <div style={{ width: "100%", marginTop: "40px" }}>
          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>📊 Distribución por Comercio</h2>

          {dataGrafico.length === 0 ? (
            <p style={{ textAlign: "center" }}>No hay datos este mes</p>
          ) : (
            <>
              <div style={{ width: "100%", height: `${chartHeight}px`, maxWidth: isMobile ? "100%" : "860px", margin: "0 auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataGrafico} dataKey="total" nameKey="nombre" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                      {dataGrafico.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>

                    <circle cx="50%" cy="50%" r={centerHoleRadius} fill="white" />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fill: "#111827", fontSize: `${centerMainFont}px`, fontWeight: 800 }}>{totalMes.toFixed(2)} €</text>
                    <text x="50%" y="50%" dy={isMobile ? 22 : 28} textAnchor="middle" dominantBaseline="middle" style={{ fill: "#111827", fontSize: `${centerSubFont}px`, fontWeight: 600 }}>Total gastado</text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={styles.legendBox}>
                {dataGraficoOrdenado.map((item) => (
                  <div key={item.nombre} style={styles.legendRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ ...styles.legendDot, background: item.color }} />
                      <span style={{ fontWeight: 700 }}>{item.nombre}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{Number(item.total).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "40px", display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap" }}>
                {participanteA ? (
                  <div style={{ textAlign: "center" }}>
                    <h3>{participanteA.nombre}</h3>
                    <p style={{ fontSize: "20px", fontWeight: "600" }}>{totalParticipanteA.toFixed(2)} €</p>
                  </div>
                ) : null}

                {participanteB ? (
                  <div style={{ textAlign: "center" }}>
                    <h3>{participanteB.nombre}</h3>
                    <p style={{ fontSize: "20px", fontWeight: "600" }}>{totalParticipanteB.toFixed(2)} €</p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { background: "#4a505e", minHeight: "100vh", width: "100%", padding: "40px", color: "white", boxSizing: "border-box" },
  title: { fontSize: "32px", marginBottom: "20px", textAlign: "center" },

  selectorRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
    justifyContent: "center"
  },

  select: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: "44px"
  },

  monthYearSelect: {
    width: "100%",
    maxWidth: "200px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "2px solid rgba(255,255,255,0.12)",
    minHeight: "46px",
    background: "white",
    color: "#111827",
    outline: "none",
    display: "block",
    margin: "0 auto",
    textAlign: "center",
    textAlignLast: "center"
  },

  authScreen: {
    minHeight: "100vh",
    width: "100%",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 100%)",
    color: "white",
    padding: "24px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  authGlowOne: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(59,130,246,0.20)",
    filter: "blur(70px)",
    top: "-80px",
    left: "-80px",
    pointerEvents: "none"
  },
  authGlowTwo: {
    position: "absolute",
    width: "360px",
    height: "360px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.18)",
    filter: "blur(70px)",
    bottom: "-90px",
    right: "-70px",
    pointerEvents: "none"
  },
  authWrapper: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: "1160px",
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: "28px",
    alignItems: "center"
  },
  authBrandBlock: {
    padding: "24px 10px 24px 0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  },
  authBrandBadge: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "flex-start",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#e2e8f0",
    padding: "10px 14px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    marginBottom: "18px",
    backdropFilter: "blur(8px)"
  },
  authHeroTitle: {
    fontSize: "clamp(32px, 5vw, 56px)",
    lineHeight: 1.04,
    fontWeight: 900,
    margin: "0 0 16px 0",
    maxWidth: "620px"
  },
  authHeroText: {
    fontSize: "17px",
    lineHeight: 1.7,
    color: "#cbd5e1",
    maxWidth: "600px",
    margin: 0
  },
  authFeatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    marginTop: "28px",
    maxWidth: "760px"
  },
  authFeatureCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "18px",
    padding: "18px 16px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.18)"
  },
  authFeatureIcon: {
    fontSize: "22px",
    marginBottom: "10px"
  },
  authFeatureTitle: {
    fontSize: "15px",
    fontWeight: 800,
    marginBottom: "6px"
  },
  authFeatureText: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#cbd5e1"
  },
  authCard: {
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    padding: "26px",
    boxSizing: "border-box",
    backdropFilter: "blur(18px)",
    boxShadow: "0 28px 70px rgba(2,6,23,0.40)"
  },
  authCardTop: {
    marginBottom: "18px",
    textAlign: "center"
  },
  authTitle: {
    margin: "0 0 10px 0",
    fontSize: "30px",
    fontWeight: 900
  },
  authSubtitle: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.6
  },
  authTabsWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "16px",
    padding: "7px",
    marginBottom: "18px"
  },
  authTab: {
    background: "transparent",
    color: "#cbd5e1",
    padding: "11px 8px",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "13px"
  },
  authTabActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
    padding: "11px 8px",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "13px",
    boxShadow: "0 10px 22px rgba(37,99,235,0.35)"
  },
  authForm: {
    width: "100%"
  },
  authInput: {
    display: "block",
    width: "100%",
    marginBottom: "12px",
    padding: "15px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    boxSizing: "border-box",
    fontSize: "15px"
  },
  authErrorBox: {
    background: "rgba(239,68,68,0.16)",
    border: "1px solid rgba(248,113,113,0.35)",
    color: "#fecaca",
    padding: "12px 14px",
    borderRadius: "14px",
    marginBottom: "14px",
    fontSize: "14px",
    lineHeight: 1.5
  },
  authPrimaryButtonBlue: {
    width: "100%",
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
    padding: "15px 16px",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "15px",
    boxShadow: "0 16px 34px rgba(37,99,235,0.34)"
  },
  authPrimaryButtonGreen: {
    width: "100%",
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    color: "#062b13",
    padding: "15px 16px",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "15px",
    boxShadow: "0 16px 34px rgba(34,197,94,0.28)"
  },

  topTabsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    maxWidth: "920px",
    margin: "0 auto 22px auto",
    background: "rgba(15,23,42,0.25)",
    padding: "8px",
    borderRadius: "18px",
    backdropFilter: "blur(8px)"
  },

  topTabsContainerMobile: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    width: "100%",
    maxWidth: "100%",
    margin: "0 auto 18px auto",
    background: "rgba(15,23,42,0.28)",
    padding: "8px",
    borderRadius: "18px",
    boxSizing: "border-box",
    backdropFilter: "blur(10px)"
  },

  topTab: {
    background: "rgba(15,23,42,0.86)",
    color: "#cbd5e1",
    padding: "12px 6px",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "12px",
    minHeight: "48px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  topTabActive: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
    padding: "12px 6px",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "12px",
    minHeight: "48px",
    boxShadow: "0 14px 30px rgba(37,99,235,0.36)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  balanceCard: {
    background: "#1e293b",
    padding: "14px 18px",
    borderRadius: "10px",
    textAlign: "center",
    maxWidth: "520px",
    minHeight: "68px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px auto"
  },
  balanceCardPaid: { background: "#22c55e" },
  balanceCardUnpaid: { background: "#ef4444" },
  balanceCardBigText: { color: "#111827", textTransform: "uppercase", fontWeight: 900, margin: 0 },
  balanceNeutralText: { margin: 0, fontSize: "18px", fontWeight: 800 },

  cardFull: { background: "#1e293b", padding: "20px", borderRadius: "10px", marginBottom: "30px", textAlign: "center" },
  formContainer: {
    width: "100%",
    maxWidth: "280px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" },
  card: { background: "#1e293b", padding: "20px", borderRadius: "10px", textAlign: "center", boxSizing: "border-box", width: "100%" },
  gastoItem: { display: "flex", justifyContent: "space-between", marginBottom: "10px", gap: "10px" },
  input: { display: "block", width: "100%", marginBottom: "10px", padding: "8px", borderRadius: "6px", border: "none" },
  inputCompact: {
    display: "block",
    width: "100%",
    marginBottom: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "none",
    boxSizing: "border-box",
    textAlign: "left"
  },

  gastoLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    textAlign: "left"
  },

  gastoTexto: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
    flex: 1,
    textAlign: "left",
    fontSize: "14px",
    lineHeight: 1.2
  },

  gastoRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexShrink: 0
  },

  gastoImporte: {
    fontWeight: 700,
    fontSize: "14px",
    whiteSpace: "nowrap"
  },

  gastoIndividualWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginTop: "14px",
    alignItems: "center",
    justifyContent: "center"
  },

  gastoIndividualRow: {
    display: "grid",
    gridTemplateColumns: "28px 90px 24px 80px",
    alignItems: "center",
    columnGap: "10px",
    justifyContent: "center"
  },

  gastoIndividualNombre: {
    textAlign: "left",
    fontWeight: "600",
    whiteSpace: "nowrap"
  },

  gastoIndividualArrow: {
    textAlign: "center",
    fontWeight: "700"
  },

  gastoIndividualImporte: {
    textAlign: "left",
    fontWeight: "700",
    whiteSpace: "nowrap"
  },

  cardHeaderRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "10px", minHeight: "34px" },
  cardTitle: { position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0, width: "100%", textAlign: "center", pointerEvents: "none" },

  superFormRow: { display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "10px", width: "100%", boxSizing: "border-box" },
  inputSuper: { display: "block", width: "70%", maxWidth: "260px", padding: "8px", borderRadius: "6px", border: "none" },

  buttonAddInline: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
    padding: "10px 14px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 800,
    boxShadow: "0 12px 24px rgba(37,99,235,0.28)"
  },

  button: { background: "#3b82f6", color: "white", padding: "10px", border: "none", borderRadius: "6px", cursor: "pointer" },
  buttonDanger: { background: "#ef4444", color: "white", padding: "10px 15px", border: "none", borderRadius: "6px", cursor: "pointer" },
  buttonDangerSmall: {
    background: "#ef4444",
    color: "white",
    padding: "8px 14px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700
  },
  buttonPaid: { background: "#22c55e", color: "#111827", padding: "10px 15px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 800 },
  buttonNotifOn: { background: "#22c55e", color: "#111827", padding: "12px 18px", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 800 },
  buttonNotifOff: { background: "#64748b", color: "white", padding: "12px 18px", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 800 },

  buttonEdit: { background: "#facc15", border: "none", borderRadius: "5px", padding: "4px 8px", marginRight: "5px", cursor: "pointer" },
  buttonDelete: { background: "#ef4444", border: "none", borderRadius: "5px", padding: "4px 8px", cursor: "pointer" },

  buttonEditMini: {
    background: "#facc15",
    border: "none",
    borderRadius: "5px",
    padding: "3px 6px",
    minWidth: "28px",
    height: "28px",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: 1
  },

  buttonDeleteMini: {
    background: "#ef4444",
    border: "none",
    borderRadius: "5px",
    padding: "3px 6px",
    minWidth: "28px",
    height: "28px",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: 1
  },

  buttonCenter: { display: "flex", justifyContent: "center" },

  mobileActionColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    flexShrink: 0,
    minWidth: "58px"
  },

  mobileIconButtonsWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    width: "100%"
  },

  mobileIconButtonsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 },
  modal: { background: "#1e293b", padding: "25px", borderRadius: "10px", width: "90%", maxWidth: "340px" },

  buttonSuperEdit: { background: "#06b6d4", color: "white", border: "none", borderRadius: "999px", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },

  payIcon: { width: "28px", height: "28px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 },
  payMirko: { background: "#22c55e", color: "white" },
  payJessica: { background: "#ec4899", color: "white" },

  legendBox: { maxWidth: "650px", margin: "28px auto 0 auto", background: "#1e293b", padding: "18px", borderRadius: "10px" },
  legendRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  legendDot: { width: "14px", height: "14px", borderRadius: "999px", display: "inline-block" },

  calHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  buttonAddCalendar: { background: "#06b6d4", color: "white", padding: "10px 14px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 800 },

  calendarPageWrap: { width: "100%", maxWidth: "1100px", margin: "0 auto" },
  calendarPageWrapMobile: { width: "100vw", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" },

  calendarCard: { background: "#1e293b", padding: "18px", borderRadius: "10px", boxSizing: "border-box", width: "100%", overflowX: "hidden" },
  calendarCardMobile: { padding: "14px 10px", borderRadius: "10px", width: "100vw" },

  calWeekHeaderUnified: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px", marginBottom: "8px" },
  calWeekHeaderCellUnified: { background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "8px 0", fontWeight: 900, fontSize: "12px", textAlign: "center" },

  calGridUnified: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px" },

  calCellPcDot: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px", minHeight: "110px", boxSizing: "border-box", display: "flex", flexDirection: "column", cursor: "pointer" },
  calCellMobileDot: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "7px", minHeight: "72px", boxSizing: "border-box", display: "flex", flexDirection: "column", cursor: "pointer" },

  calCellEmpty: { background: "rgba(255,255,255,0.03)" },
  calCellToday: { outline: "2px solid rgba(34,197,94,0.9)" },

  calCellDotTop: { display: "flex", alignItems: "flex-start", justifyContent: "center" },
  calDayNumber: { fontWeight: 900, opacity: 0.9, fontSize: "13px", textAlign: "center", width: "100%" },
  calDayNumberToday: { color: "#22c55e" },

  dotCenterWrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  dotGreenPc: { width: "12px", height: "12px", borderRadius: "999px", background: "#39ff14", boxShadow: "0 0 10px rgba(57,255,20,0.8)" },
  dotGreenMobile: { width: "8px", height: "8px", borderRadius: "999px", background: "#39ff14", boxShadow: "0 0 8px rgba(57,255,20,0.8)" },

  dayDetailRow: { background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px" },

  hamburgerButton: {
    position: "fixed",
    top: "8px",
    left: "8px",
    width: "35px",
    height: "35px",
    borderRadius: "8px",
    border: "none",
    background: "#1e293b",
    color: "white",
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 10001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.25)"
  },

  menuOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 10000
  },

  sideMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "min(340px, 86vw)",
    height: "100vh",
    background: "#1e293b",
    zIndex: 10002,
    padding: "22px 18px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    transition: "transform 0.25s ease"
  },

  sideMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingBottom: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.12)"
  },

  sideMenuAvatar: {
    width: "54px",
    height: "54px",
    borderRadius: "999px",
    background: "#3b82f6",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 800,
    flexShrink: 0
  },

  sideMenuUserName: {
    fontSize: "18px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  sideMenuSubtext: {
    fontSize: "14px",
    opacity: 0.85,
    marginTop: "4px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  sideMenuSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },

  sideMenuItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    textAlign: "left",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    padding: "12px"
  },

  sideMenuLabel: {
    fontSize: "13px",
    opacity: 0.75,
    fontWeight: 700
  },

  sideMenuValue: {
    fontSize: "16px",
    fontWeight: 800,
    wordBreak: "break-word"
  },

  sideMenuDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.12)",
    margin: "2px 0"
  },

  sideMenuNotifOn: {
    background: "#22c55e",
    color: "#111827",
    padding: "12px 14px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 800,
    width: "100%"
  },

  sideMenuNotifOff: {
    background: "#64748b",
    color: "white",
    padding: "12px 14px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 800,
    width: "100%"
  }
};

export default App;
