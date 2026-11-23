import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // ajustá la ruta a tu cliente de Supabase

export interface ComboItemConfig {
  id?: string;
  combo_id?: string;
  producto_nombre?: string | null;
  categoria?: string | null;
  cantidad: number;
}

export interface ComboConfig {
  id: string;
  nombre: string;
  descripcion?: string | null;
  imagen?: string | null;
  precio_dinero: number;
  precio_puntos: number;
  incluye_entrada: boolean;
  cantidad_entradas: number;
  activo: boolean;
  items: ComboItemConfig[];
}

export interface ComboConDisponibilidad extends ComboConfig {
  stockDisponible: number;
  habilitado: boolean;
  cantidadDeseada: number;
}

export interface ProductoAgrupadoRef {
  id?: string;
  nombre: string;
  categoria: string;
  stock: number;
  cantidadDeseada?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CombosService {
  async getCombosConItems(soloActivos = false): Promise<ComboConfig[]> {
    let query = supabase
      .from('combos')
      .select(`
        id,
        nombre,
        descripcion,
        imagen,
        precio_dinero,
        precio_puntos,
        incluye_entrada,
        cantidad_entradas,
        activo,
        combo_items (
          id,
          combo_id,
          producto_nombre,
          categoria,
          cantidad
        )
      `)
      .order('created_at', { ascending: false });

    if (soloActivos) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al obtener combos: ${error.message}`);
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      imagen: c.imagen,
      precio_dinero: Number(c.precio_dinero) || 0,
      precio_puntos: Number(c.precio_puntos) || 0,
      incluye_entrada: Boolean(c.incluye_entrada),
      cantidad_entradas: Number(c.cantidad_entradas) || 0,
      activo: Boolean(c.activo),
      items: Array.isArray(c.combo_items) ? c.combo_items : [],
    }));
  }

  async crearCombo(combo: Omit<ComboConfig, 'id'>): Promise<ComboConfig> {
    const { data: comboCreado, error: comboError } = await supabase
      .from('combos')
      .insert({
        nombre: combo.nombre,
        descripcion: combo.descripcion || null,
        imagen: combo.imagen || null,
        precio_dinero: combo.precio_dinero,
        precio_puntos: combo.precio_puntos,
        incluye_entrada: combo.incluye_entrada,
        cantidad_entradas: combo.incluye_entrada ? Math.max(1, combo.cantidad_entradas || 1) : 0,
        activo: combo.activo ?? true,
      })
      .select()
      .single();

    if (comboError || !comboCreado) {
      throw new Error(`Error al crear combo: ${comboError?.message || 'sin respuesta'}`);
    }

    let itemsInsertados: ComboItemConfig[] = [];
    if (combo.items && combo.items.length > 0) {
      const filasItems = combo.items.map((it) => ({
        combo_id: comboCreado.id,
        producto_nombre: it.producto_nombre?.trim() || null,
        categoria: it.categoria?.trim().toLowerCase() || null,
        cantidad: Math.max(1, Number(it.cantidad) || 1),
      }));

      const { data: itemsData, error: itemsError } = await supabase
        .from('combo_items')
        .insert(filasItems)
        .select();

      if (itemsError) {
        throw new Error(`Error al guardar componentes del combo: ${itemsError.message}`);
      }
      itemsInsertados = itemsData || [];
    }

    return {
      ...comboCreado,
      precio_dinero: Number(comboCreado.precio_dinero) || 0,
      precio_puntos: Number(comboCreado.precio_puntos) || 0,
      items: itemsInsertados,
    };
  }

  calcularDisponibilidadCombos(
    combosBase: ComboConfig[],
    productosAgrupados: ProductoAgrupadoRef[],
    cantidadesPrevias: Record<string, number> = {},
    asientosSeleccionadosCount = 0
  ): ComboConDisponibilidad[] {
    return combosBase.map((combo) => {
      const stockDisponible = this.calcularStockDeUnCombo(
        combo,
        productosAgrupados,
        asientosSeleccionadosCount
      );

      const previa = cantidadesPrevias[combo.id] || 0;
      const cantidadAjustada = Math.min(previa, stockDisponible);

      return {
        ...combo,
        stockDisponible,
        habilitado: combo.activo && stockDisponible > 0,
        cantidadDeseada: cantidadAjustada,
      };
    });
  }

  private calcularStockDeUnCombo(
    combo: ComboConfig,
    productosAgrupados: ProductoAgrupadoRef[],
    asientosSeleccionadosCount: number
  ): number {
    if (!combo.activo || !combo.items || combo.items.length === 0) {
      return 0;
    }

    const disponibilidades: number[] = combo.items.map((item) => {
      const cantRequerida = Math.max(1, Number(item.cantidad) || 1);

      const unidadesDisponibles = productosAgrupados
        .filter((prod) => {
          const matchNombre = item.producto_nombre
            ? prod.nombre.trim().toLowerCase() === item.producto_nombre.trim().toLowerCase()
            : true;

          const matchCategoria = item.categoria
            ? prod.categoria.trim().toLowerCase() === item.categoria.trim().toLowerCase()
            : true;

          return matchNombre && matchCategoria;
        })
        .reduce((acc, prod) => acc + (Number(prod.stock) || 0), 0);

      return Math.floor(unidadesDisponibles / cantRequerida);
    });

    // Si el combo requiere entradas y hay asientos seleccionados, limitamos por cantidad de asientos
    if (combo.incluye_entrada && combo.cantidad_entradas > 0 && asientosSeleccionadosCount > 0) {
      disponibilidades.push(
        Math.floor(asientosSeleccionadosCount / combo.cantidad_entradas)
      );
    }

    if (disponibilidades.length === 0) {
      return 0;
    }

    return Math.max(0, Math.min(...disponibilidades));
  }
}