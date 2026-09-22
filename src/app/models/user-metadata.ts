export interface ClienteMetadata {
  rol: 'cliente';
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre: string;
  colorOjos: string;
  vacaciones: number;
  // email y password NO van aquí, los maneja Supabase Auth
}

export interface EmpleadoMetadata {
  rol: 'empleado';
  nombre: string;
  apellido: string;
  email: string;
  // password NO se tipa aquí, se maneja en la query
}

export interface AdminMetadata {
  rol: 'admin';
  email: string;
  // password igual que empleado, solo en la query
}

export interface AnonimoMetadata {
  rol: 'anonimo';
  nombre?: string;
}
