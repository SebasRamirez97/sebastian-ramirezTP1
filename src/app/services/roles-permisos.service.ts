import { Injectable, signal } from '@angular/core';
import { supabase } from './supabaseClient';

export type ClavePermiso =
  | 'peliculas'
  | 'candybar'
  | 'promociones'
  | 'reportes'
  | 'verificar_orden';

export interface AccesoRuta {
  ruta: string;
  etiqueta: string;
}

export interface DefinicionPermiso {
  clave: ClavePermiso;
  titulo: string;
  descripcion: string;
  rutaDashboard: string;
  etiquetaBoton: string;
  rutas: AccesoRuta[];
}

export interface RolItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  permisos: ClavePermiso[];
  activo: boolean;
}

export interface EmpleadoConRol {
  id: string;
  nombre: string;
  apellido: string;
  estado: string | null;
  rol_id: string | null;
  rol_nombre: string | null;
  permisos: ClavePermiso[];
}

export const CATALOGO_PERMISOS: DefinicionPermiso[] = [
  {
    clave: 'peliculas',
    titulo: 'Encargado de Películas',
    descripcion: 'Cartelera, agregar películas, funciones y agenda de funciones',
    rutaDashboard: '/lista-funciones',
    etiquetaBoton: 'Gestionar funciones y películas',
    rutas: [
      { ruta: '/cartelera', etiqueta: 'Cartelera' },
      { ruta: '/armar-cartelera', etiqueta: 'Crear Película' },
      { ruta: '/crear-funcion', etiqueta: 'Crear Función' },
      { ruta: '/lista-funciones', etiqueta: 'Agenda Funciones' },
      { ruta: '/proximamente', etiqueta: 'Próximamente' },
    ],
  },
  {
    clave: 'candybar',
    titulo: 'Encargado de CandyBar',
    descripcion: 'Administrar candy bar, agregar productos y armar combos',
    rutaDashboard: '/crear-producto',
    etiquetaBoton: 'Administrar Candy Bar',
    rutas: [
      { ruta: '/candybar', etiqueta: 'Candy Bar' },
      { ruta: '/crear-producto', etiqueta: 'Crear Producto' },
      { ruta: '/crear-combo', etiqueta: 'Crear Combo' },
    ],
  },
  {
    clave: 'promociones',
    titulo: 'Encargado de Promociones',
    descripcion: 'Gestionar cupones y promociones',
    rutaDashboard: '/gestionar-cupones',
    etiquetaBoton: 'Gestionar cupones',
    rutas: [
      { ruta: '/gestionar-cupones', etiqueta: 'Gestionar Cupones' },
    ],
  },
  {
    clave: 'reportes',
    titulo: 'Monitor de Reportes',
    descripcion: 'Revisar reportes y métricas',
    rutaDashboard: '/reportes',
    etiquetaBoton: 'Ver reportes',
    rutas: [
      { ruta: '/reportes', etiqueta: 'Reportes' },
    ],
  },
  {
    clave: 'verificar_orden',
    titulo: 'Encargado de Verificar Órdenes',
    descripcion: 'Verificar órdenes y códigos de retiro',
    rutaDashboard: '/verificar-orden',
    etiquetaBoton: 'Verificar órdenes',
    rutas: [
      { ruta: '/verificar-orden', etiqueta: 'Verificar Orden' },
    ],
  },
];

@Injectable({
  providedIn: 'root',
})
export class RolesPermisosService {
  readonly catalogoPermisos = CATALOGO_PERMISOS;
  permisosActuales = signal<ClavePermiso[]>([]);
  esAdminGeneral = signal<boolean>(false);

  async obtenerRoles(): Promise<RolItem[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener roles: ${error.message}`);
    }

    return (data as RolItem[]) || [];
  }

  async obtenerEmpleadosConRoles(): Promise<EmpleadoConRol[]> {
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        id,
        nombre,
        apellido,
        estado,
        rol_id,
        roles (
          id,
          nombre,
          permisos
        )
      `)
      .order('apellido', { ascending: true });

    if (error) {
      throw new Error(`Error al cargar empleados: ${error.message}`);
    }

    return ((data as any[]) || []).map((emp) => {
      const rol = Array.isArray(emp.roles) ? emp.roles[0] : emp.roles;
      return {
        id: emp.id,
        nombre: emp.nombre,
        apellido: emp.apellido,
        estado: emp.estado,
        rol_id: emp.rol_id ?? null,
        rol_nombre: rol?.nombre ?? null,
        permisos: (rol?.permisos || []) as ClavePermiso[],
      };
    });
  }

  async asignarRolAEmpleado(empleadoId: string, rolId: string | null): Promise<void> {
    const { error } = await supabase
      .from('empleados')
      .update({ rol_id: rolId })
      .eq('id', empleadoId);

    if (error) {
      throw new Error(`Error al asignar rol al empleado: ${error.message}`);
    }
  }

  async cargarPermisosUsuarioActual(): Promise<{
    esAdmin: boolean;
    permisos: ClavePermiso[];
  }> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      this.esAdminGeneral.set(false);
      this.permisosActuales.set([]);
      return { esAdmin: false, permisos: [] };
    }

    const rolMeta = String(
      user.user_metadata?.['rol'] || user.app_metadata?.['rol'] || '',
    ).toLowerCase();

    if (rolMeta === 'admin' || rolMeta === 'administrador') {
      const todos = CATALOGO_PERMISOS.map((p) => p.clave);
      this.esAdminGeneral.set(true);
      this.permisosActuales.set(todos);
      return { esAdmin: true, permisos: todos };
    }

    const { data: empleado, error } = await supabase
      .from('empleados')
      .select(`
        estado,
        rol_id,
        roles (
          permisos
        )
      `)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error al consultar permisos del empleado:', error.message);
      this.esAdminGeneral.set(false);
      this.permisosActuales.set([]);
      return { esAdmin: false, permisos: [] };
    }

    if (empleado?.estado && empleado.estado.toLowerCase() !== 'activo') {
      this.esAdminGeneral.set(false);
      this.permisosActuales.set([]);
      return { esAdmin: false, permisos: [] };
    }

    const rolObj = Array.isArray((empleado as any)?.roles)
      ? (empleado as any).roles[0]
      : (empleado as any)?.roles;

    const permisos = (rolObj?.permisos || []) as ClavePermiso[];
    this.esAdminGeneral.set(false);
    this.permisosActuales.set(permisos);
    return { esAdmin: false, permisos };
  }

  obtenerRutasPermitidas(permisos: ClavePermiso[] = this.permisosActuales()): AccesoRuta[] {
    const setPermisos = new Set(permisos);
    const rutasMap = new Map<string, AccesoRuta>();

    for (const def of CATALOGO_PERMISOS) {
      if (setPermisos.has(def.clave)) {
        for (const r of def.rutas) {
          rutasMap.set(r.ruta, r);
        }
      }
    }

    return Array.from(rutasMap.values());
  }

  async puedeAccederARuta(ruta: string): Promise<boolean> {
    const estado = await this.cargarPermisosUsuarioActual();
    if (estado.esAdmin) return true;

    const permitidas = this.obtenerRutasPermitidas(estado.permisos);
    return permitidas.some((r) => ruta === r.ruta || ruta.startsWith(`${r.ruta}/`));
  }

  async tienePermiso(permiso: ClavePermiso): Promise<boolean> {
    const estado = await this.cargarPermisosUsuarioActual();
    if (estado.esAdmin) return true;
    return estado.permisos.includes(permiso);
  }
}