class ServiceError(Exception):
    """Base exception for business logic service errors."""
    pass


class WorkflowError(ServiceError):
    """Raised when an invalid workflow transition is attempted."""
    pass


class ValidationError(ServiceError):
    """Raised when domain or entity validation fails."""
    pass


class NotFoundError(ServiceError):
    """Raised when a requested resource is not found."""
    pass
