import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router'; // 👈 importa router-outlet
import { AuthService } from './services/auth.service';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from './models/user-metadata';
import { SidebarComponent } from './components/sidebar/sidebar.component'; // 👈 importa tu sidebar
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  rol: string = '';

    constructor(private authService: AuthService, public router: Router) {}

  async ngOnInit() {
    // 1. Intentar obtener cliente registrado (Supabase Auth)
    const user = await this.authService.getUser();
    if (user) {
      // 👇 casteo según el rol
      const metadata = user.user_metadata as ClienteMetadata | EmpleadoMetadata | AdminMetadata;
      this.rol = metadata.rol ?? '';
      return;
    }
    // 2. Intentar obtener cliente anónimo (localStorage)
    const anonimo = this.authService.getAnonimo();
    if (anonimo) {
      const metadata = anonimo as AnonimoMetadata;
      this.rol = metadata.rol;
      return;
    }
    // 3. Si no hay sesión activa
    this.rol = '';
  }

  async cerrarSesion() {
    await this.authService.signOut();
    this.rol = ''; // resetear estado
    this.router.navigate(['/login']);
  }
}

