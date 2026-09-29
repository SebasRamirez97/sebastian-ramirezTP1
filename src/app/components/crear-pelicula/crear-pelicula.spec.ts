import { ComponentFixture, TestBed } from '@angular/core/testing';
import {CrearPeliculaComponent } from './crear-pelicula';

describe('CrearPelicula', () => {
  let component: CrearPeliculaComponent;
  let fixture: ComponentFixture<CrearPeliculaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPeliculaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearPeliculaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
