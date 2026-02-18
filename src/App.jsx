import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "./firebase";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function App() {

  const [vista, setVista] = useState("dashboard");
  const [balance, setBalance] = useState(0);
  const [importe, setImporte] = useState("");
  const [pagadoPor, setPagadoPor] = useState("mdekot@gmail.com");
  const [comercio, setComercio] = useState("");
  const [gastos, setGastos] = useState([]);

  const [mesActual, setMesActual] = useState(2);
  const [anioActual, setAnioActual] = useState(2026);

  const [gastoEditando, setGastoEditando] = useState(null);
  const [editComercio, setEditComercio] = useState("");
  const [editImporte, setEditImporte] = useState("");
  const [editPagadoPor, setEditPagadoPor] = useState("");

  const [gastoAEliminar, setGastoAEliminar] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  const formatearComercio = (texto) => {
    if (!texto) return "";
    return texto
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  const calcularBalance = async () => {
    const snapshot = await getDocs(collection(db, "gastos"));

    let totalPagado = 0;
    let totalDebe = 0;
    let lista = [];

    snapshot.forEach((documento) => {
      const data = documento.data();

      if (
        data.mes === mesActual &&
        data.anio === anioActual &&
        data.liquidado === false
      ) {
        lista.push({ id: documento.id, ...data });

        const parte = data.importe / data.participantesCount;

        if (data.pagadoPor === "mdekot@gmail.com") {
          totalPagado += data.importe;
          totalDebe += parte;
        } else {
          totalDebe += parte;
        }
      }
    });

    lista.sort((a, b) => {
      if (!a.fecha || !b.fecha) return 0;
      const fechaA = a.fecha.seconds ? a.fecha.seconds * 1000 : a.fecha;
      const fechaB = b.fecha.seconds ? b.fecha.seconds * 1000 : b.fecha;
      return fechaB - fechaA;
    });

    setGastos(lista);
    setBalance(totalPagado - totalDebe);
  };

  useEffect(() => {
    calcularBalance();
  }, [mesActual, anioActual]);

  const agregarGasto = async () => {
    if (!importe || !comercio) return;

    await addDoc(collection(db, "gastos"), {
      importe: Number(importe),
      pagadoPor,
      mes: mesActual,
      anio: anioActual,
      liquidado: false,
      divididoEntre: [
        "mdekot@gmail.com",
        "jessica.alca87@gmail.com"
      ],
      participantesCount: 2,
      comercio: formatearComercio(comercio),
      fecha: new Date()
    });

    setImporte("");
    setComercio("");
    calcularBalance();
  };

  const confirmarEliminar = async () => {
    await deleteDoc(doc(db, "gastos", gastoAEliminar.id));
    setGastoAEliminar(null);
    calcularBalance();
  };

  const abrirModalEditar = (gasto) => {
    setGastoEditando(gasto);
    setEditComercio(gasto.comercio);
    setEditImporte(gasto.importe);
    setEditPagadoPor(gasto.pagadoPor);
  };

  const guardarEdicion = async () => {
    await updateDoc(doc(db, "gastos", gastoEditando.id), {
      comercio: formatearComercio(editComercio),
      importe: Number(editImporte),
      pagadoPor: editPagadoPor
    });

    setGastoEditando(null);
    calcularBalance();
  };

  const liquidarMes = async () => {
    const snapshot = await getDocs(collection(db, "gastos"));

    snapshot.forEach(async (documento) => {
      const data = documento.data();
      if (
        data.mes === mesActual &&
        data.anio === anioActual &&
        data.liquidado === false
      ) {
        await updateDoc(doc(db, "gastos", documento.id), {
          liquidado: true
        });
      }
    });

    calcularBalance();
  };

  const resumenComercio = {};
  gastos.forEach((g) => {
    if (!resumenComercio[g.comercio]) resumenComercio[g.comercio] = 0;
    resumenComercio[g.comercio] += g.importe;
  });

  const dataGrafico = Object.entries(resumenComercio).map(([nombre, total]) => ({
    nombre,
    total
  }));

  let totalMirko = 0;
  let totalJessica = 0;

  gastos.forEach((g) => {
    if (g.pagadoPor === "mdekot@gmail.com") totalMirko += g.importe;
    else totalJessica += g.importe;
  });

  const totalMes = totalMirko + totalJessica;

  return (
    <div style={styles.container}>

      <div style={styles.tabs}>
        <button onClick={() => setVista("dashboard")} style={vista === "dashboard" ? styles.tabActive : styles.tab}>
          Dashboard
        </button>
        <button onClick={() => setVista("grafico")} style={vista === "grafico" ? styles.tabActive : styles.tab}>
          Gráfico Mensual
        </button>
      </div>

      {vista === "dashboard" && (
        <>
          <h1 style={styles.title}>💰💶 GESTIÓN MDEKOT 💶💰</h1>

          <div style={styles.selectorRow}>
            <select value={mesActual} onChange={(e) => setMesActual(Number(e.target.value))} style={styles.select}>
              {meses.map((mes, index) => (
                <option key={index} value={index + 1}>{mes}</option>
              ))}
            </select>
            <input type="number" value={anioActual} onChange={(e) => setAnioActual(Number(e.target.value))} style={styles.select} />
          </div>

          <div style={styles.balanceCard}>
            {balance > 0 && <h2>Jessica debe {balance.toFixed(2)} € a Mirko</h2>}
            {balance < 0 && <h2>Mirko debe {Math.abs(balance).toFixed(2)} € a Jessica</h2>}
            {balance === 0 && <h2>⚖️ Estáis en empate</h2>}
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>· TOTAL GASTOS ·</h3>
              <h2>{totalMes.toFixed(2)} €</h2>
            </div>
          </div>
        </>
      )}

      {vista === "grafico" && (
        <div style={{ width: "100%", marginTop: "40px" }}>

          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>
            📊 Distribución por Comercio
          </h2>

          {dataGrafico.length === 0 ? (
            <p style={{ textAlign: "center" }}>No hay datos este mes</p>
          ) : (
            <>
              <div style={{ width: "100%", height: "400px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataGrafico}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={3}
                    >
                      {dataGrafico.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"][index % 6]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  marginTop: "40px",
                  display: "flex",
                  justifyContent: "center",
                  gap: "60px",
                  flexWrap: "wrap"
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <h3>Mirko</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>
                    {totalMirko.toFixed(2)} €
                  </p>
                </div>

                <div style={{ textAlign: "center" }}>
                  <h3>Jessica</h3>
                  <p style={{ fontSize: "20px", fontWeight: "600" }}>
                    {totalJessica.toFixed(2)} €
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}

const styles = {
  container:{background:"#4a505e",minHeight:"100vh",width:"100%",padding:"40px",color:"white",boxSizing:"border-box"},
  title:{fontSize:"32px",marginBottom:"20px",textAlign:"center"},
  selectorRow:{display:"flex",gap:"10px",marginBottom:"20px",flexWrap:"wrap"},
  select:{padding:"8px",borderRadius:"6px"},
  balanceCard:{background:"#1e293b",padding:"20px",borderRadius:"10px",marginBottom:"30px",textAlign:"center",maxWidth:"600px",margin:"0 auto 30px auto"},
  cardFull:{background:"#1e293b",padding:"20px",borderRadius:"10px",marginBottom:"30px",textAlign:"center"},
  formContainer:{width:"100%",maxWidth:"500px",margin:"0 auto"},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"20px",marginBottom:"30px"},
  card:{background:"#1e293b",padding:"20px",borderRadius:"10px",textAlign:"center"},
  gastoItem:{display:"flex",justifyContent:"space-between",marginBottom:"8px"},
  input:{display:"block",width:"100%",marginBottom:"10px",padding:"8px",borderRadius:"6px",border:"none"},
  button:{background:"#3b82f6",color:"white",padding:"10px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonDanger:{background:"#ef4444",color:"white",padding:"10px 15px",border:"none",borderRadius:"6px",cursor:"pointer"},
  buttonEdit:{background:"#facc15",border:"none",borderRadius:"5px",padding:"4px 8px",marginRight:"5px",cursor:"pointer"},
  buttonDelete:{background:"#ef4444",border:"none",borderRadius:"5px",padding:"4px 8px",cursor:"pointer"},
  buttonCenter:{display:"flex",justifyContent:"center"},
  tabs:{display:"flex",justifyContent:"center",gap:"10px",marginBottom:"20px",flexWrap:"wrap"},
  tab:{background:"#1e293b",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  tabActive:{background:"#3b82f6",color:"white",padding:"10px 20px",border:"none",borderRadius:"6px",cursor:"pointer"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center"},
  modal:{background:"#1e293b",padding:"25px",borderRadius:"10px",width:"90%",maxWidth:"320px"}
};

export default App;
