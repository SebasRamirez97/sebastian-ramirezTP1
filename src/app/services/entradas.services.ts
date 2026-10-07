import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase

@Injectable({
  providedIn: 'root',
})
export class EntradasService {
  constructor() { }

  /**
   * Genera un código aleatorio limpio de 7 letras mayúsculas
   */
  private generarCodigoRetiro(): string {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let codigo = '';
    for (let i = 0; i < 7; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
  }

  /**
   * Obtiene todas las entradas existentes para una función específica
   */
  async getEntradasPorFuncion(funcionId: string): Promise<any[]> {
    const { data, error } = await supabase.from('entradas').select('*').eq('funcion_id', funcionId);

    if (error) {
      throw new Error(`Error al cargar los asientos: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Bloquea un asiento inmediatamente al hacer clic (Acepta string o null para usuarioId)
   */
  async bloquearAsiento(
    funcionId: string,
    usuarioId: string | null,
    fila: string,
    numeroAsiento: number,
  ): Promise<any> {
    // Quitamos .single() y .select() complejos que causan el conflicto 400
    const { data, error } = await supabase
      .from('entradas')
      .insert([
        {
          funcion_id: funcionId,
          usuario_id: usuarioId,
          fila: fila,
          numero_asiento: numeroAsiento,
          estado: 'seleccionado',
          aprobada: false,
        }
      ])
      .select(); // Devolvemos el array insertado sin forzar .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este asiento acaba de ser seleccionado por otro usuario.');
      }
      throw new Error(`No se pudo seleccionar el asiento: ${error.message}`);
    }

    // Retornamos el primer elemento insertado con éxito
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Libera/Borra el asiento si el usuario lo deselecciona o cancela
   */
  async liberarAsiento(entradaId: string): Promise<void> {
    const { error } = await supabase.from('entradas').delete().eq('id', entradaId);

    if (error) {
      throw new Error(`Error al liberar el asiento: ${error.message}`);
    }
  }

  /**
   * Confirma la compra: Calcula el total y genera la orden unificada.
   */
  async confirmarCompra(usuarioId: string | null, asientosSeleccionados: any[], metodoPago: string = 'efectivo'): Promise<string> {
    if (asientosSeleccionados.length === 0) {
      throw new Error('No hay asientos seleccionados para comprar.');
    }

    const funcionId = asientosSeleccionados[0].funcion_id;

    const { data: funcionData, error: errorFuncion } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos')
      .eq('id', funcionId)
      .single();

    if (errorFuncion || !funcionData) {
      throw new Error('No se pudo obtener la información de precios de la función.');
    }

    let totalCalculado = 0;

    if (metodoPago === 'puntos') {
      const precioPuntosUnitario = funcionData.precio_puntos || 0;
      totalCalculado = asientosSeleccionados.length * precioPuntosUnitario;
    } else {
      const precioPesosUnitario = funcionData.precio_pesos || 0;
      totalCalculado = asientosSeleccionados.length * precioPesosUnitario;
    }

    const codigoUnico = this.generarCodigoRetiro();
    const idsAsientos = asientosSeleccionados.map((a) => a.id);

    // Creamos la orden principal permitiendo usuario_id nulo si es anónimo
    const { data: orden, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId, // Puede ser null para invitados
          codigo_retiro: codigoUnico,
          estado: 'pagado',
          total: totalCalculado,
          metodo_pago: metodoPago
        },
      ])
      .select()
      .single();

    if (errorOrden) throw new Error(`Error al generar la orden: ${errorOrden.message}`);

    const { error: errorEntradas } = await supabase
      .from('entradas')
      .update({
        estado: 'comprado',
        orden_id: orden.id,
      })
      .in('id', idsAsientos);

    if (errorEntradas) throw new Error(`Error al actualizar entradas: ${errorEntradas.message}`);

    return codigoUnico;
  }

  async confirmarCompraConCandy(
    usuarioId: string | null,
    asientos: any[] = [], 
    metodoPago: string,
    itemsCandyJson: any[] = [],
    itemsConIdsFisicos: any[] = [],
    totalGeneral: number = 0 // 👈 Recibimos el total sumado de entradas + candy
  ): Promise<string> {
    const codigoRetiro = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Creamos la orden principal guardando el total correcto en la columna correspondiente
    const { data: ordenCreada, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId,
          codigo_retiro: codigoRetiro,
          metodo_pago: metodoPago,
          estado: 'pagado',
          total: totalGeneral, // 👈 Aquí se guarda la suma total de dinero
          items_candy: itemsCandyJson.length > 0 ? itemsCandyJson : null
        }
      ])
      .select()
      .single();

    if (errorOrden) throw errorOrden;

    // 2. 🎟️ Actualizamos entradas de cine
    if (asientos && asientos.length > 0) {
      const idsAsientos = asientos.map(a => a.id);
      const { error: errorAsientos } = await supabase
        .from('entradas')
        .update({ estado: 'ocupado', orden_id: ordenCreada.id })
        .in('id', idsAsientos);

      if (errorAsientos) throw errorAsientos;
    }

    // 3. 🍿 Reservamos productos del Candy Bar físicos
    const idsFisicosAreservar: string[] = [];
    itemsConIdsFisicos.forEach(item => {
      if (item.idsFisicos) {
        idsFisicosAreservar.push(...item.idsFisicos);
      }
    });

    if (idsFisicosAreservar.length > 0) {
      const { error: errorReserva } = await supabase
        .from('productos')
        .update({
          estado: 'reservado',
          orden_id: ordenCreada.id
        })
        .in('id', idsFisicosAreservar);

      if (errorReserva) throw errorReserva;
    }

    return codigoRetiro;
  }
async verificarYAprobarOrden(codigoRetiro: string): Promise<any> {
    // 1. Buscar la orden por su código de retiro
    const { data: orden, error: errorBusqueda } = await supabase
      .from('ordenes')
      .select('id, estado, total, metodo_pago, items_candy')
      .eq('codigo_retiro', codigoRetiro.trim().toUpperCase())
      .single();

    if (errorBusqueda || !orden) {
      throw new Error('No se encontró ninguna orden con el código ingresado.');
    }

    if (orden.estado === 'aprobado') {
      throw new Error('Esta orden ya fue verificada y aprobada anteriormente.');
    }

    // 2. Actualizar el estado de la orden principal a 'aprobado'
    const { data: ordenActualizada, error: errorUpdateOrden } = await supabase
      .from('ordenes')
      .update({ estado: 'aprobado' })
      .eq('id', orden.id)
      .select()
      .single();

    if (errorUpdateOrden) {
      throw new Error(`Error al aprobar la orden: ${errorUpdateOrden.message}`);
    }

    // 3. Actualizar el estado de las entradas asociadas (si las tiene) a 'retirado'
    const { error: errorEntradas } = await supabase
      .from('entradas')
      .update({ estado: 'retirado' })
      .eq('orden_id', orden.id);

    if (errorEntradas) {
      console.error('Nota: La orden puede no contener entradas de cine.', errorEntradas.message);
    }

    // 4. 🍿 Actualizar el estado en la tabla 'productos' de 'comprado' a 'retirado'
    // Opción A: Actualizar directamente todos los productos físicos vinculados a esta orden_id (más seguro y directo)
    const { error: errorProdOrden } = await supabase
      .from('productos')
      .update({ estado: 'retirado' })
      .eq('orden_id', orden.id)
      .eq('estado', 'comprado'); // Solo los que estaban comprados

    if (errorProdOrden) {
      console.error('Error al actualizar los productos de la orden:', errorProdOrden.message);
    }

    // Opción B (Respaldada por si usas items_candy en JSON): Recorrer los items por ID por si acaso
    if (orden.items_candy && Array.isArray(orden.items_candy) && orden.items_candy.length > 0) {
      for (const item of orden.items_candy) {
        const productoId = item.id || item.producto_id;

        if (productoId) {
          await supabase
            .from('productos')
            .update({ estado: 'retirado' })
            .eq('id', productoId)
            .eq('estado', 'comprado');
        }
      }
    }

    return ordenActualizada;
  }
}