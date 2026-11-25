import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-mis-ordenes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-ordenes.html',
  styleUrls: ['./mis-ordenes.css']
})
export class MisOrdenesComponent implements OnInit {
  private router = inject(Router);

  misOrdenes = signal<any[]>([]);
  cargando = signal<boolean>(true);
  ordenSeleccionada = signal<any | null>(null);

  ordenACancelar = signal<any | null>(null);
  cancelandoOrden = signal<boolean>(false);
  mensajeEstado = signal<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargarMisOrdenes();
  }

  async cargarMisOrdenes(): Promise<void> {
    try {
      this.cargando.set(true);
      const { data: authData } = await supabase.auth.getUser();
      const usuarioId = authData?.user?.id;

      if (!usuarioId) {
        this.cargando.set(false);
        return;
      }

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          codigo_retiro,
          metodo_pago,
          total,
          estado,
          created_at,
          items_candy,
          entradas_resumen,
          entradas (
            id,
            fila,
            numero_asiento,
            estado,
            funciones (
              fecha_inicio,
              formato,
              salas (nombre),
              peliculas (nombre, imagen)
            )
          )
        `)
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordenes = data || [];

      // Guardamos en `entradas_resumen` la sala y coordenadas si aún no están guardadas
      for (const orden of ordenes) {
        const tieneRelacion = Array.isArray(orden.entradas) && orden.entradas.length > 0;
        const tieneResumen = Array.isArray(orden.entradas_resumen) && orden.entradas_resumen.length > 0;

        if (tieneRelacion && !tieneResumen) {
          const resumen = orden.entradas.map((e: any) => ({
            fila: e.fila,
            numero_asiento: e.numero_asiento,
            sala: e.funciones?.salas?.nombre || 'Sala',
            formato: e.funciones?.formato || null,
            fecha_inicio: e.funciones?.fecha_inicio || null,
            pelicula: e.funciones?.peliculas?.nombre || null,
          }));

          orden.entradas_resumen = resumen;

          await supabase
            .from('ordenes')
            .update({ entradas_resumen: resumen })
            .eq('id', orden.id);
        }
      }

      this.misOrdenes.set(ordenes);
    } catch (error: any) {
      console.error('Error al cargar órdenes:', error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // 🔹 Devuelve los asientos activos de la relación o el respaldo guardado en `entradas_resumen`
  obtenerAsientosOrden(orden: any): any[] {
    if (Array.isArray(orden?.entradas) && orden.entradas.length > 0) {
      return orden.entradas;
    }
    if (Array.isArray(orden?.entradas_resumen) && orden.entradas_resumen.length > 0) {
      return orden.entradas_resumen;
    }
    return [];
  }

  obtenerSalaOrden(orden: any): string {
    const asientos = this.obtenerAsientosOrden(orden);
    const primero = asientos[0];
    return primero?.funciones?.salas?.nombre || primero?.sala || 'Sala';
  }

  estaCancelada(orden: any): boolean {
    return (orden?.estado || '').toLowerCase() === 'cancelada';
  }

  estaAprobada(orden: any): boolean {
    return (orden?.estado || '').toLowerCase() === 'aprobado';
  }

  // 🔹 Permite cancelar hasta 2 horas antes de la función
  // 🔹 Permite cancelar solo si NO está cancelada ni aprobada, y hasta 2 horas antes de la función
  puedeCancelarOrden(orden: any): boolean {
    if (!orden || this.estaCancelada(orden) || this.estaAprobada(orden)) {
      return false;
    }

    const entradas = this.obtenerAsientosOrden(orden);
    const primeraEntrada = entradas.find(
      (e: any) => e?.funciones?.fecha_inicio || e?.fecha_inicio
    );
    const fechaInicio = primeraEntrada?.funciones?.fecha_inicio || primeraEntrada?.fecha_inicio;

    if (fechaInicio) {
      const inicioMs = new Date(fechaInicio).getTime();
      if (Number.isNaN(inicioMs)) return false;

      const dosHorasMs = 2 * 60 * 60 * 1000;
      return inicioMs - Date.now() >= dosHorasMs;
    }

    return true;
  }

  calcularCreditoReembolso(orden: any): number {
    const total = Number(orden?.total || 0);
    return Number((total / 2).toFixed(2));
  }

  solicitarCancelacion(orden: any): void {
    this.mensajeEstado.set(null);
    if (!this.puedeCancelarOrden(orden)) {
      const mensaje = this.estaAprobada(orden)
        ? 'No podés cancelar una orden que ya fue aprobada o retirada.'
        : 'Solo podés cancelar una compra hasta 2 horas antes del inicio de la función.';
      this.mensajeEstado.set({
        tipo: 'error',
        texto: mensaje,
      });
      return;
    }
    this.ordenACancelar.set(orden);
  }

  cerrarModalCancelacion(): void {
    if (!this.cancelandoOrden()) {
      this.ordenACancelar.set(null);
    }
  }

  async confirmarCancelacionOrden(): Promise<void> {
    const orden = this.ordenACancelar();
    if (!orden || this.cancelandoOrden()) return;

    if (!this.puedeCancelarOrden(orden)) {
      this.ordenACancelar.set(null);
      this.mensajeEstado.set({
        tipo: 'error',
        texto: 'Ya no estás dentro del plazo de 2 horas previas a la función para cancelar.',
      });
      return;
    }

    try {
      this.cancelandoOrden.set(true);
      this.mensajeEstado.set(null);

      const { data: authData } = await supabase.auth.getUser();
      const usuarioId = authData?.user?.id;
      if (!usuarioId) {
        throw new Error('No se pudo identificar al usuario.');
      }

      const creditoOtorgado = this.calcularCreditoReembolso(orden);

      // 1. Sumar el 50% del total en créditos al cliente
      const { data: clienteActual, error: errCliente } = await supabase
        .from('clientes')
        .select('creditos')
        .eq('id', usuarioId)
        .single();

      if (errCliente) throw errCliente;

      const creditosPrevios = Number(clienteActual?.creditos || 0);
      const nuevosCreditos = Number((creditosPrevios + creditoOtorgado).toFixed(2));

      const { error: errUpdateCliente } = await supabase
        .from('clientes')
        .update({ creditos: nuevosCreditos })
        .eq('id', usuarioId);

      if (errUpdateCliente) throw errUpdateCliente;

      // 2. Devolver butacas a disponible
      const { error: errEntradas } = await supabase
        .from('entradas')
        .update({
          estado: 'disponible',
          usuario_id: null,
          orden_id: null,
        })
        .eq('orden_id', orden.id);

      if (errEntradas) throw errEntradas;

      // 3. Devolver productos comprados a disponible
      const { error: errProductos } = await supabase
        .from('productos')
        .update({
          estado: 'disponible',
          orden_id: null,
        })
        .eq('orden_id', orden.id);

      if (errProductos) throw errProductos;

      // 4. Marcar la orden como cancelada
      const { error: errOrden } = await supabase
        .from('ordenes')
        .update({ estado: 'cancelada' })
        .eq('id', orden.id);

      if (errOrden) throw errOrden;

      this.ordenACancelar.set(null);
      if (this.ordenSeleccionada()?.id === orden.id) {
        this.ordenSeleccionada.set(null);
      }

      await this.cargarMisOrdenes();

      this.mensajeEstado.set({
        tipo: 'exito',
        texto: `Compra cancelada. Se acreditaron $${creditoOtorgado.toFixed(2)} en créditos y se repusieron las butacas y productos.`,
      });
    } catch (error: any) {
      console.error('Error al cancelar la orden:', error);
      this.mensajeEstado.set({
        tipo: 'error',
        texto: `No se pudo cancelar la compra: ${error.message || 'error inesperado'}`,
      });
    } finally {
      this.cancelandoOrden.set(false);
    }
  }

  trackByOrden(index: number, orden: any): string {
    return orden.id;
  }

  trackByEntrada(index: number, entrada: any): string {
    return entrada?.id || `${entrada?.fila}-${entrada?.numero_asiento}`;
  }

  trackByCandy(index: number, candy: any): string {
    return candy.nombre;
  }

  verDetallesOrden(orden: any): void {
    this.ordenSeleccionada.set(orden);
  }

  cerrarDetalles(): void {
    this.ordenSeleccionada.set(null);
  }

  volver(): void {
    this.router.navigate(['/home']);
  }
}