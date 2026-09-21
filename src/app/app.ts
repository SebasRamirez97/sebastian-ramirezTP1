import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  rol: string = '';

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    // 1. Intentar obtener cliente registrado
    const user = await this.authService.getUser();
    if (user) {
      this.rol = user.user_metadata?.rol || '';
      return;
    }

    // 2. Intentar obtener cliente anónimo
    const anonimo = this.authService.getAnonimo();
    if (anonimo) {
      this.rol = anonimo.rol;
      return;
    }

    // 3. Si no hay sesión activa
    this.rol = '';
  }
}
