import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetallePeliculaComponent } from './detalle-pelicula';

describe('DetallePelicula', () => {
  let component: DetallePeliculaComponent;
  let fixture: ComponentFixture<DetallePeliculaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallePeliculaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DetallePeliculaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
