import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';
import type { CreateExperimentDto, UpdateExperimentDto } from './schemas/experiment.schema';

describe('ExperimentsController', () => {
  let controller: ExperimentsController;
  let service: ExperimentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
    service = module.get<ExperimentsService>(ExperimentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an experiment with userId', async () => {
      const dto: CreateExperimentDto = {
        name: 'test',
        status: 'provisioning',
        visibility: 'private',
        embargoIntervalDays: 90,
        createdBy: '123',
      };
      const userId = '123';
      await controller.create(dto, userId);
      expect(service.create).toHaveBeenCalledWith(dto, userId);
    });
  });

  describe('findAll', () => {
    it('should return all experiments when no filter', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should filter experiments with userId and filter', async () => {
      const userId = '123';
      const filter = 'my';
      await controller.findAll(userId, filter);
      expect(service.findAll).toHaveBeenCalledWith(userId, filter);
    });
  });

  describe('findOne', () => {
    it('should find one experiment by id', async () => {
      const id = '123';
      await controller.findOne(id);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update an experiment', async () => {
      const id = '123';
      const dto: UpdateExperimentDto = {
        name: 'updated',
        status: 'active',
      };
      await controller.update(id, dto);
      expect(service.update).toHaveBeenCalledWith(id, dto);
    });
  });
}); 