/**
 * Entidades puras del Dominio (Core Domain)
 * Arquitectura Hexagonal - Sin dependencias externas ni de bases de datos u ORMs.
 */

export class Career {
  constructor({ id = null, name, facultad = 'Ciencias Sociales' }) {
    this.id = id;
    this.name = name;
    this.facultad = facultad;
  }
}

export class Subject {
  constructor({ id = null, name, careerId = null, plan = '', semester = '', careerName = '' }) {
    this.id = id;
    this.name = name;
    this.careerId = careerId;
    this.plan = plan;
    this.semester = semester;
    this.careerName = careerName;
  }
}

export class Title {
  constructor({
    id = null,
    normalizedAuthor = '',
    normalizedTitle = '',
    originalAuthor = '',
    originalTitle = '',
    year = '',
    publisher = '',
    edition = '',
    format = '',
    physicalAvailability = '',
    onlineAvailability = '',
    place = '',
    chapter = '',
    language = 'Español',
    typeBib = 'básica'
  }) {
    this.id = id;
    this.normalizedAuthor = normalizedAuthor;
    this.normalizedTitle = normalizedTitle;
    this.originalAuthor = originalAuthor;
    this.originalTitle = originalTitle;
    this.year = year;
    this.publisher = publisher;
    this.edition = edition;
    this.format = format;
    this.physicalAvailability = physicalAvailability;
    this.onlineAvailability = onlineAvailability;
    this.place = place;
    this.chapter = chapter;
    this.language = language;
    this.typeBib = typeBib;
  }
}

export class Acquisition {
  constructor({
    id = null,
    titleId = null,
    status = 'no disponible',
    availablePrinted = false,
    availableDigital = false
  }) {
    this.id = id;
    this.titleId = titleId;
    this.status = status;
    this.availablePrinted = availablePrinted;
    this.availableDigital = availableDigital;
  }
}
